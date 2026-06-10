const { ValidationPipe } = require('@nestjs/common');
const { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } = require('class-validator');

// Create an invalid enum
const bad_enum = {};

class TestDto {
  @IsEnum(bad_enum)
  @IsOptional()
  priority;
}

async function run() {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  try {
    const result = await pipe.transform({ priority: 'HIGH' }, { type: 'body', metatype: TestDto });
    console.log("Success:", result);
  } catch (err) {
    console.error("Error:", err.response);
  }
}

run();
