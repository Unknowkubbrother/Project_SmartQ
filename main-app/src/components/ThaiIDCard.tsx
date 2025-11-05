import {ThaiIDCardData} from "@/interfaces";

function ThaiIDCard({cardData}: {cardData: ThaiIDCardData | null}) {
  return (
        <div>
          <div id="cid">{cardData?.CID}</div>
          <div id="fullname-th">{cardData?.FULLNAME_TH}</div>
          {/* <div id="fullname-en">{cardData?.FULLNAME_EN}</div> */}
          <div id="birth">{cardData?.BIRTH}</div>
          {/* <div id="gender">{cardData?.GENDER}</div> */}
          {/* <div id="religion">{cardData?.RELIGION}</div> */}
          <div id="address">{cardData?.ADDRESS}</div>
          {/* <div id="issuer">{cardData?.ISSUER}</div> */}
          <div id="issue">{cardData?.ISSUE}</div>
          <div id="expire">{cardData?.EXPIRE}</div>
          {/* <div id="docno">{cardData?.DOCNO}</div> */}
        </div>
  );
}

export default ThaiIDCard;