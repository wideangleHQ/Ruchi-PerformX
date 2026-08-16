import { NestFactory } from '"'"'@nestjs/core'"'"';
import { AppModule } from '"'"'./src/app.module'"'"';
NestFactory.create(AppModule, { logger: false })
  .then(async (app) => { console.log('"'"'BOOT_OK'"'"'); await app.close(); process.exit(0); })
  .catch((e: unknown) => {
    console.log('"'"'BOOT_FAILED'"'"');
    console.log(e instanceof Error ? e.message.split('"'"'\n'"'"')[0] : String(e));
    process.exit(1);
  });
TS
out=$(timeout 120 npx ts-node --transpile-only .boot-check.ts 2>&1)
rm -f .boot-check.ts
if echo "$out" | grep -q BOOT_OK; then
    echo "Nest container builds. Every controller-owning module has its guards in scope."
else
    echo "$out" | tail -6
    exit 1
fi
