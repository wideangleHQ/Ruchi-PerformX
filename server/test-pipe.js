const { ValidationPipe } = require('@nestjs/common');
const { CreateSelfActionDto } = require('./dist/modules/self-actions/dto/create-self-action.dto');

async function run() {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  try {
    const result = await pipe.transform({ title: 'Test', description: 'Test', priority: 'HIGH' }, { type: 'body', metatype: CreateSelfActionDto });
    console.log("Success:", result);
  } catch (err) {
    console.error("Error:", err.response);
  }
}

run();
