SELECT = [0x00, 0xA4, 0x04, 0x00, 0x08]
THAI_ID_CARD = [0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01]

GENDER = ['-','ชาย','หญิง']    
RELIGION = ['-','พุทธ','อิสลาม','คริสต์','พราหมณ์-ฮินดู','ซิกข์','ยิว','เชน','โซโรอัสเตอร์','บาไฮ','ไม่นับถือศาสนา','ไม่ทราบ']


APDU_DATA=[
    {
        'key':'APDU_CID', 
        'id':'CID',
        'desc': 'เลขบัตรประชาชน',
        'apdu':[0x80, 0xb0, 0x00, 0x04, 0x02, 0x00, 0x0d]
    },

    {
        'key':'APDU_THFULLNAME',  
        'id':'FULLNAME-TH',
        'desc': 'ชื่อ-นามสุกล(TH)',
        'apdu':[0x80, 0xb0, 0x00, 0x11, 0x02, 0x00, 0x64]
    },
    {
        'key':'APDU_ENFULLNAME', 
        'id':'FULLNAME-EN',
        'desc': 'ชื่อ-นามสุกล(EN)',
        'apdu':[0x80, 0xb0, 0x00, 0x75, 0x02, 0x00, 0x64]
        },
    {
        'key':'APDU_BIRTH', 
        'id':'BIRTH',
        'desc': 'วันเดือนปีเกิด',
        'apdu': [0x80, 0xb0, 0x00, 0xD9, 0x02, 0x00, 0x08]
        },
    {
        'key':'APDU_GENDER', 
        'id':'GENDER',
        'desc': 'เพศ',
        'apdu': [0x80, 0xb0, 0x00, 0xE1, 0x02, 0x00, 0x01]
        },
    {
        'key':'APDU_ISSUER', 
        'id':'ISSUER',
        'desc': 'ผู้ออกบัตร',
        'apdu': [0x80, 0xb0, 0x00, 0xF6, 0x02, 0x00, 0x64]
        },
    {
        'key':'APDU_ISSUE', 
        'id':'ISSUE',
        'desc': 'บัตร-วันเริ่มใช้',
        'apdu': [0x80, 0xb0, 0x01, 0x67, 0x02, 0x00, 0x08]
        },
    {
        'key':'APDU_EXPIRE', 
        'id':'EXPIRE',
        'desc': 'บัตร-วันหมดอายุ',
        'apdu':[0x80, 0xb0, 0x01, 0x6F, 0x02, 0x00, 0x08]
        },
    {
        'key':'APDU_ADDRESS', 
        'id':'ADDRESS',
        'desc': 'ที่อยู่',
        'apdu':[0x80, 0xb0, 0x15, 0x79, 0x02, 0x00, 0x64]
        },

    {
        'key':'APDU_RELIGION', 
        'id':'RELIGION',
        'desc': 'ศาสนา',
        'apdu':[0x80, 0xb0, 0x01, 0x77, 0x02, 0x00, 0x02]
        },

    {
        'key':'APDU_DOCNO', 
        'id':'DOCNO',
        'desc': 'เลขใต้บัตร',
        'apdu':[0x80, 0xb0, 0x16, 0x19, 0x02, 0x00, 0x0E]
        },
      

]