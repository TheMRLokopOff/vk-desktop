import { isObject } from './utils';

function processCopy(value: any) {
  if (isObject(value)) {
    return copyObject(value);
  } else if (Array.isArray(value)) {
    return copyArray(value);
  }

  return value;
}

function copyArray(arr: any[]) {
  const newArr = [];

  for (let i = 0; i < arr.length; i++) {
    newArr.push(processCopy(arr[i]));
  }

  return newArr;
}

export default function copyObject<ObjType>(obj: ObjType) {
  const newObj = {} as ObjType;

  for (const key in obj) {
    newObj[key] = processCopy(obj[key]);
  }

  return newObj;
}
