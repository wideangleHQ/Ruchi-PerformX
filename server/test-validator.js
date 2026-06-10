const { getMetadataStorage } = require('class-validator');
const { CreateSelfActionDto } = require('./dist/modules/self-actions/dto/create-self-action.dto');

const storage = getMetadataStorage();
const metadatas = storage.getTargetValidationMetadatas(CreateSelfActionDto, '', true, false);
console.log(metadatas.map(m => ({ property: m.propertyName, type: m.type, name: m.name })));
