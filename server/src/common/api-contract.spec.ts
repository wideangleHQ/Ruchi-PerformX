import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The client and the server have to agree on field names, and nothing made
 * them.
 *
 * `main.ts` sets `forbidNonWhitelisted: true`, so a payload carrying a key the
 * DTO does not declare is a 400, not a field the server quietly ignores. The
 * server is not consistent about casing: the Phase 1 modules and `events`,
 * `holidays`, `polls` and `assets` are camelCase, while `leave`, `rnd`,
 * `projects` and the vendor work tables are snake_case. Neither is wrong, but a
 * client that guesses gets a 400 at runtime and a green typecheck, which is how
 * the whole projects module shipped unable to write anything.
 *
 * This reads both trees and compares them. It is regex parsing rather than a
 * real TypeScript program, so a call it cannot read is reported rather than
 * skipped, and that list is asserted too. A new entry there fails the test and
 * has to be either taught to the resolver or written into READ_BY_HAND with a
 * reason.
 *
 * ponytail: regex over two source trees, no ts-morph and no codegen. Generate
 * the client from the DTOs if this surface ever outgrows it.
 */

const SERVER_SRC = resolve(__dirname, '..');
const CLIENT_API = resolve(__dirname, '../../../client/src/api');

/**
 * Calls whose payload is assembled with a conditional spread, which cannot be
 * read statically. Both were checked against their DTOs by hand:
 * `VendorTaskStatusDto` is `{ status, reason? }`, `SubmitDeliverableDto` is
 * `{ remarks? }`. Rewriting either to a plain object literal would make the
 * resolver read it, and is the right move if they gain a field.
 */
const READ_BY_HAND = [
  'vendorPortal.ts submitDeliverable: last parameter is not an object type',
  'vendorPortal.ts updateTaskStatus: last parameter is not an object type',
];

/**
 * Multipart parts handled by a FileInterceptor rather than body keys, so a DTO
 * that does not declare them is correct. Skipping the field rather than the
 * whole call keeps the rest of a multipart payload checked, which is where
 * `dueDate` would otherwise hide.
 */
const FILE_FIELDS = new Set(['attachments', 'file', 'files', 'receipt', 'requestAttachments']);

// ------------------------------------------------------------------ plumbing

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** A capture group that the pattern guarantees, as a string. */
function group(match: RegExpMatchArray, index: number): string {
  return match[index] ?? '';
}

/** Reads forward from `start` to the brace closing the block it opened. */
function sliceBlock(source: string, start: number): string {
  let depth = 1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return source.slice(start);
}

/** Splits on commas that sit outside brackets of every kind. */
function splitTopLevel(source: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of source) {
    if ('<{(['.includes(char)) depth += 1;
    if ('>})]'.includes(char)) depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  return parts;
}

/**
 * The keys of an object literal. `{ a, b: c }` gives `['a', 'b']`, taking the
 * key rather than the value. Undefined for anything with a spread or a computed
 * key, because those cannot be read without evaluating them.
 */
function objectKeys(source: string): string[] | undefined {
  const keys: string[] = [];
  for (const entry of splitTopLevel(source)) {
    const text = entry.trim();
    if (text === '') continue;
    if (text.startsWith('...') || text.startsWith('[')) return undefined;
    const key = (text.split(':')[0] ?? '').trim();
    if (!/^[a-zA-Z_]\w*$/.test(key)) return undefined;
    keys.push(key);
  }
  return keys;
}

/** `/projects/:id/members/:userId` and `/projects/${a}/members/${b}` both collapse to the same key. */
function normalisePath(path: string): string {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment.startsWith(':') || segment.includes('${') ? '*' : segment));
  return `/${segments.join('/')}`;
}

// --------------------------------------------------------------- server side

/** Every DTO class in the server, by class name, to the properties it declares. */
function readServerDtos(): Map<string, Set<string>> {
  const bodies = new Map<string, string>();
  const parents = new Map<string, string>();

  for (const file of walk(SERVER_SRC).filter((path) => path.endsWith('.dto.ts'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /export class (\w+)(?:\s+extends\s+(?:PartialType\()?(\w+)\)?)?\s*\{/g,
    )) {
      const name = group(match, 1);
      const parent = match[2];
      bodies.set(name, sliceBlock(source, match.index + match[0].length));
      if (parent !== undefined) parents.set(name, parent);
    }
  }

  const fields = new Map<string, Set<string>>();

  const collect = (name: string, seen: Set<string>): Set<string> => {
    const cached = fields.get(name);
    if (cached) return cached;
    const set = new Set<string>();
    if (seen.has(name)) return set;
    seen.add(name);

    const body = bodies.get(name);
    if (body === undefined) return set;
    for (const property of body.matchAll(/^\s+(?:readonly\s+)?([a-zA-Z_]\w*)[?!]?:\s/gm)) {
      set.add(group(property, 1));
    }

    const parent = parents.get(name);
    if (parent !== undefined) for (const inherited of collect(parent, seen)) set.add(inherited);

    fields.set(name, set);
    return set;
  };

  for (const name of bodies.keys()) collect(name, new Set());
  return fields;
}

interface ServerRoute {
  bodyDto?: string;
  queryDto?: string;
  /**
   * Whether the handler carries a `FileInterceptor`. Express parses no
   * `multipart/form-data` without one, so a FormData body arrives empty and
   * every declared DTO field fails validation at once. That is what shipped on
   * `POST /leave/applications`.
   */
  multipart: boolean;
}

/** `POST /projects` and `GET /vendor-assignments` to the DTOs sitting behind them. */
function readServerRoutes(): Map<string, ServerRoute> {
  const routes = new Map<string, ServerRoute>();

  for (const file of walk(SERVER_SRC).filter((path) => path.endsWith('.controller.ts'))) {
    const source = readFileSync(file, 'utf8');
    const prefixMatch = source.match(/@Controller\((?:'([^']*)')?\)/);
    if (!prefixMatch) continue;
    const prefix = prefixMatch[1] ?? '';

    for (const handler of source.matchAll(
      /@(Get|Post|Patch|Put|Delete)\((?:'([^']*)')?\)([\s\S]*?)\)\s*\{/g,
    )) {
      const verb = group(handler, 1);
      const sub = handler[2] ?? '';
      const signature = group(handler, 3);

      // A second route decorator inside the match means it ran past its handler.
      if (/@(Get|Post|Patch|Put|Delete)\(/.test(signature)) continue;

      const body = signature.match(/@Body\(\)\s*\w+:\s*(\w+)/);
      const query = signature.match(/@Query\(\)\s*\w+:\s*(\w+)/);

      const route: ServerRoute = { multipart: /\w+Interceptor\s*\(/.test(signature) };
      if (body) route.bodyDto = group(body, 1);
      if (query) route.queryDto = group(query, 1);

      routes.set(`${verb.toUpperCase()} ${normalisePath(`${prefix}/${sub}`)}`, route);
    }
  }

  return routes;
}

// --------------------------------------------------------------- client side

/**
 * Every interface and type alias under `client/src/api`. An interface's heritage
 * clause is kept as a «extends X» marker in front of its body, because the body
 * alone loses it.
 */
function readClientTypes(): Map<string, string> {
  const bodies = new Map<string, string>();

  for (const file of walk(CLIENT_API)) {
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(/export interface (\w+)(?:\s+extends\s+([\w<>, ']+?))?\s*\{/g)) {
      const heritage = match[2] === undefined ? '' : `«extends ${match[2]}»`;
      const body = sliceBlock(source, match.index + match[0].length);
      bodies.set(group(match, 1), `${heritage}{${body}}`);
    }

    for (const match of source.matchAll(/export type (\w+)\s*=\s*([^;]+);/g)) {
      bodies.set(group(match, 1), group(match, 2).trim());
    }
  }

  return bodies;
}

type Resolution = { fields: Set<string> } | { unresolved: string };

/** Turns a client type expression into the set of keys it puts on the wire. */
function resolveClientFields(
  expr: string,
  types: Map<string, string>,
  seen: Set<string> = new Set(),
): Resolution {
  let text = expr.trim();

  const heritage = text.match(/^«extends ([^»]+)»([\s\S]*)$/);
  let inherited: Set<string> | undefined;
  if (heritage) {
    const parent = resolveClientFields(group(heritage, 1), types, seen);
    if ('unresolved' in parent) return parent;
    inherited = parent.fields;
    text = group(heritage, 2).trim();
  }

  const inline = text.match(/^\{([\s\S]*)\}$/);
  if (inline) {
    const fields = new Set<string>(inherited);
    for (const property of group(inline, 1).matchAll(/([a-zA-Z_]\w*)\??:/g)) {
      fields.add(group(property, 1));
    }
    return { fields };
  }
  if (inherited && text === '') return { fields: inherited };

  const partial = text.match(/^Partial<([\s\S]+)>$/);
  if (partial) return resolveClientFields(group(partial, 1), types, seen);

  const pick = text.match(/^Pick<\s*\w+\s*,([\s\S]+)>$/);
  if (pick) {
    const fields = new Set<string>();
    for (const literal of group(pick, 1).matchAll(/'([^']+)'/g)) fields.add(group(literal, 1));
    return { fields };
  }

  const omit = text.match(/^Omit<\s*(\w+)\s*,([\s\S]+)>$/);
  if (omit) {
    const base = resolveClientFields(group(omit, 1), types, seen);
    if ('unresolved' in base) return base;
    const dropped = new Set([...group(omit, 2).matchAll(/'([^']+)'/g)].map((m) => group(m, 1)));
    return { fields: new Set([...base.fields].filter((field) => !dropped.has(field))) };
  }

  if (/^\w+$/.test(text)) {
    if (seen.has(text)) return { unresolved: `circular reference to ${text}` };
    seen.add(text);
    const body = types.get(text);
    if (body === undefined) return { unresolved: 'last parameter is not an object type' };
    return resolveClientFields(body, types, seen);
  }

  return { unresolved: text.replace(/\s+/g, ' ').slice(0, 60) };
}

interface ClientCall {
  where: string;
  verb: string;
  path: string;
  bodyType?: string;
  queryKeys?: string[];
  /** The call assembles a `FormData`, so it goes out as multipart. */
  multipart?: boolean;
}

/** Every write, and every read that sends query parameters, in the client api layer. */
function readClientCalls(): ClientCall[] {
  const calls: ClientCall[] = [];

  for (const file of walk(CLIENT_API)) {
    const source = readFileSync(file, 'utf8');
    const name = file.slice(CLIENT_API.length + 1);

    for (const method of source.matchAll(
      /^ {2}(\w+): async \(([\s\S]*?)\):\s*Promise<[\s\S]*?> => \{/gm,
    )) {
      const where = `${name} ${group(method, 1)}`;
      const params = group(method, 2);
      const body = sliceBlock(source, method.index + method[0].length);

      const call = body.match(
        /axiosClient\.(get|post|patch|put|delete)(?:<[\s\S]*?>)?\(\s*(?:'([^']*)'|`([^`]*)`)([\s\S]*)/,
      );
      if (!call) continue;

      const verb = group(call, 1).toUpperCase();
      const path = normalisePath(call[2] ?? call[3] ?? '');
      const rest = group(call, 4);
      const multipart = /new FormData\(\)/.test(body);

      if (verb === 'GET' || verb === 'DELETE') {
        const params = rest.match(/\{\s*params:\s*\{([^}]*)\}/);
        if (!params) continue;
        const keys = objectKeys(group(params, 1));
        if (!keys) continue;
        calls.push({ where, verb, path, queryKeys: keys });
        continue;
      }

      const literal = rest.match(/^\s*,\s*\{([^}]*)\}\s*\)/);
      if (literal) {
        const keys = objectKeys(group(literal, 1));
        if (!keys) continue;
        calls.push({
          where,
          verb,
          path,
          multipart,
          bodyType: `{${keys.map((key) => `${key}:`).join('')}}`,
        });
        continue;
      }

      const payload = lastParamType(params);
      // A multipart call is still recorded when its payload type cannot be
      // read, because the interceptor check below does not need the fields.
      if (payload === undefined) {
        if (multipart) calls.push({ where, verb, path, multipart });
        continue;
      }
      calls.push({ where, verb, path, multipart, bodyType: payload });
    }
  }

  return calls;
}

/** `id: string, payload: Partial<X>` gives `Partial<X>`, ignoring a trailing comma. */
function lastParamType(params: string): string | undefined {
  const parts = splitTopLevel(params).filter((part) => part.trim() !== '');
  const last = parts[parts.length - 1];
  if (last === undefined) return undefined;
  const colon = last.indexOf(':');
  if (colon === -1) return undefined;
  return last.slice(colon + 1).trim();
}

// ---------------------------------------------------------------- the checks

describe('client and server agree on field names', () => {
  const dtos = readServerDtos();
  const routes = readServerRoutes();
  const types = readClientTypes();
  const calls = readClientCalls();

  const unchecked: string[] = [];
  const problems: string[] = [];
  const unparsedMultipart: string[] = [];

  for (const call of calls) {
    const route = routes.get(`${call.verb} ${call.path}`);
    if (!route) continue; // A route with no DTO has nothing to disagree about.

    if (call.multipart && !route.multipart) {
      unparsedMultipart.push(
        `${call.where} -> ${call.verb} ${call.path} posts FormData, ` +
          'but the handler has no FileInterceptor, so the body arrives empty',
      );
    }

    const dtoName = call.queryKeys ? route.queryDto : route.bodyDto;
    if (dtoName === undefined) continue;

    const allowed = dtos.get(dtoName);
    if (!allowed || allowed.size === 0) {
      unchecked.push(`${call.where}: ${dtoName} declares no readable fields`);
      continue;
    }

    let sent: string[];
    if (call.queryKeys) {
      sent = call.queryKeys;
    } else {
      const resolved = resolveClientFields(call.bodyType ?? '', types);
      if ('unresolved' in resolved) {
        unchecked.push(`${call.where}: ${resolved.unresolved}`);
        continue;
      }
      sent = [...resolved.fields];
    }

    const rejected = sent.filter((field) => !allowed.has(field) && !FILE_FIELDS.has(field));
    if (rejected.length > 0) {
      problems.push(
        `${call.where} -> ${call.verb} ${call.path} (${dtoName}) sends ${rejected.join(', ')}; ` +
          `accepted: ${[...allowed].sort().join(', ')}`,
      );
    }
  }

  it('reads both sides', () => {
    expect(dtos.size).toBeGreaterThan(40);
    expect(routes.size).toBeGreaterThan(40);
    expect(types.size).toBeGreaterThan(40);
    expect(calls.length).toBeGreaterThan(30);
  });

  it('sends no field the receiving DTO would reject', () => {
    expect(problems).toEqual([]);
  });

  /**
   * Names agreeing is not enough. `POST /leave/applications` took the right
   * keys as multipart against a handler that could not parse them, so every
   * field came back "must be a string" at once and no leave could be applied
   * for.
   */
  it('posts multipart only where a FileInterceptor can read it', () => {
    expect(unparsedMultipart).toEqual([]);
  });

  /**
   * A call the resolver cannot read is a call this test does not cover. Naming
   * them keeps that visible rather than passing quietly.
   */
  it('leaves nothing silently unchecked', () => {
    expect(unchecked.sort()).toEqual(READ_BY_HAND);
  });
});
