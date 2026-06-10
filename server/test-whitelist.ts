const { ValidationPipe } = require('@nestjs/common');
const { IsOptional, IsEnum } = require('class-validator');

class TestDto {
  @IsEnum({ HIGH: 'HIGH' })
  @IsOptional()
  priority;
}

async function run() {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  try {
    const result = await pipe.transform({ priority: 'HIGH' }, { type: 'body', metatype: TestDto });
    console.log("Success");
  } catch (err) {
    console.error("Error:", err.response);
  }
}

run();
