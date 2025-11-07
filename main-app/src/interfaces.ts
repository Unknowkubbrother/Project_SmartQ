export interface ClaimType {
  claimType: string;
  claimTypeName: string;
}

export interface HospitalInfo {
  hcode: string;
  hname: string;
}

export interface ThaiIDCardData {
  CID: string,
  FULLNAME_TH: string,
  FULLNAME_EN: string,
  BIRTH: string,
  GENDER: string,
  RELIGION: string,
  ADDRESS: string,
  ISSUER: string,
  ISSUE: string,
  EXPIRE: string,
  DOCNO: string
}

export interface SmartQPayload {
  pid: string;
  titleName: string;
  fname: string;
  lname: string;
  nation: string;
  birthDate: string; // e.g. "25480320"
  sex: string;
  transDate: string; // ISO datetime
  mainInscl: string;
  subInscl: string;
  age: string;
  checkDate: string; // ISO datetime
  claimTypes: ClaimType[];
  image: string; // base64
  correlationId: string;
  hospSub: HospitalInfo;
  hospMainOp: HospitalInfo;
  hospMain: HospitalInfo;
  paidModel: string;
  startDateTime: string; // ISO datetime
  expireDateTime: string; // ISO datetime
  thaiIDCardData: ThaiIDCardData;
}

// {
//   "pid": "1279900273113",
//   "titleName": "001",
//   "fname": "ณัฐชานน",
//   "lname": "ทรัพย์มีชัย",
//   "nation": "099",
//   "birthDate": "25480320",
//   "sex": "ชาย",
//   "transDate": "2021-03-16T13:11:56",
//   "mainInscl": "(UCS) สิทธิหลักประกันสุขภาพแห่งชาติ",
//   "subInscl": "(89) ช่วงอายุ 12-59 ปี",
//   "age": "20 ปี 7 เดือน 18 วัน",
//   "checkDate": "2025-11-07T17:26:31",
//   "claimTypes": [
//     {
//       "claimType": "PG0060001",
//       "claimTypeName": "เข้ารับบริการรักษาทั่วไป (OPD/ IPD/ PP)"
//     },
//     {
//       "claimType": "PG0110001",
//       "claimTypeName": "Self Isolation"
//     },
//     {
//       "claimType": "PG0120001",
//       "claimTypeName": "UCEP PLUS (ผู้ป่วยกลุ่มอาการสีเหลืองและสีแดง)"
//     },
//     {
//       "claimType": "PG0130001",
//       "claimTypeName": "บริการฟอกเลือดด้วยเครื่องไตเทียม (HD)"
//     },
//     {
//       "claimType": "PG0180001",
//       "claimTypeName": "บริการตรวจสุขภาพที่จำเป็นตามกลุ่มวัย (เฉพาะเขต กทม)"
//     }
//   ],
//   "image": "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",
//   "correlationId": "4f376187-557c-497d-8377-b6a27d992537",
//   "hospSub": {
//     "hcode": "77702",
//     "hname": "ศสช.เมืองตำบลสระแก้ว"
//   },
//   "hospMainOp": {
//     "hcode": "10699",
//     "hname": "รพร.สระแก้ว"
//   },
//   "hospMain": {
//     "hcode": "10699",
//     "hname": "รพร.สระแก้ว"
//   },
//   "paidModel": "1",
//   "startDateTime": "2021-03-16T13:11:56",
//   "expireDateTime": "2065-03-19T23:59:59"
// }