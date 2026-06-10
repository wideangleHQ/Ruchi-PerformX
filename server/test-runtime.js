const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { SelfActionsController } = require('./dist/modules/self-actions/self-actions.controller');
const { getMetadataStorage } = require('class-validator');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const controller = app.get(SelfActionsController);
  
  // Get the design:paramtypes of the create method
  const paramTypes = Reflect.getMetadata('design:paramtypes', controller, 'create');
  console.log("ParamTypes for create:", paramTypes.map(p => p.name));

  const DtoClass = paramTypes[0];
  const storage = getMetadataStorage();
  const metadatas = storage.getTargetValidationMetadatas(DtoClass, '', true, false);
  console.log("Validation properties:", metadatas.map(m => m.propertyName));

  await app.close();
}

bootstrap();
