## Install PC/SC
   ขั้นตอนนี้คือการติดตั้งไลบรารีเพื่อให้ Linux สามารถเชื่อมต่อกับเครื่องอ่านได้ (ลีนุกซ์บางรุ่นอาจจะติดตั้งไว้แล้ว ก็สามารถข้ามได้)
1. **กรณี Ubuntu,Debian**
   1. ติดตั้ง lib/tools ที่จำเป็น ด้วย `sudo apt-get install --reinstall pcscd pcsc-tools libpcsclite1 libpcsclite-dev libpcsclite1 libccid`
   2. เมื่อติดตั้งเสร็จ ให้ทดสอบว่า smartcard ทำงวานหรือไม่ ด้วยคำสั่ง `systemctl status pcscd` จะต้อง Active หากต้องการเช็คว่าเชื่อมต่อเครื่องอ่านได้หรือไม่ ให้เสียบเครื่องอ่านและใช้คำสั่ง `pcsc_scan` จะแสดงรายการเครื่องอ่านที่เสียบอยู่

2. **กรณี Fedora,CentOS,RedHat**
   1. ติดตั้ง lib/tools ที่จำเป็น ด้วย `sudo yum -y install pcsc-tools`
   2. เมื่อติดตั้งเสร็จ ให้ทดสอบว่า smartcard ทำงวานหรือไม่ ด้วยคำสั่ง `systemctl status pcscd` จะต้อง Active หากต้องการเช็คว่าเชื่อมต่อเครื่องอ่านได้หรือไม่ ให้เสียบเครื่องอ่านและใช้คำสั่ง `pcsc_scan` จะแสดงรายการเครื่องอ่านที่เสียบอยู่


## Install โปรแกรม NHSO Secure-Agent สำหรับ Linux
1. แตก tar ไฟล์ติดตั้ง และ cd เข้าไปใน linux-installer `tar zxvf ชื่อไฟล์.tar.gz && cd linux-installer`
2. ติดตังโปรแกรม
   1. กรณี **Rasbery PI 64 bit (Aarch64)** รันคำสั่ง `sudo ./install-aarch64.sh secureagent-xxx.jar` ระบบจะทำการ ติดตั้งด้วยการสร้าง linux user secureagent จากนั้น download JDK และ ติดตั้ง systemd service และ ติดตั้งโปรแกรมที่ระบุ (ไฟล์ .jar) โดยให้แทนที่ secureagent-xxx.jar ด้วย jar เวอร์ชั่นที่ต้องการติดตั้ง
   2. กรณี **Linux x64 (Ubuntu,CentOS,Fedora,RedHat)** รันคำสั่ง `sudo ./install-x64.sh secureagent-xxx.jar` ระบบจะทำการ ติดตั้งด้วยการสร้าง linux user secureagent จากนั้น download JDK และ ติดตั้ง systemd service และ ติดตั้งโปรแกรมที่ระบุ (ไฟล์ .jar) โดยให้แทนที่ secureagent-xxx.jar ด้วย jar เวอร์ชั่นที่ต้องการติดตั้ง
3. เมื่อติดตั้งเสร็จ ให้แก้ไขไฟล์ **/home/secureagent/application-test.properties** โดยใส่ค่า TOKEN ในไฟล์นี้สำหรับเครื่องเทสท์ จากนั้น restart service ด้วย  `systemctl restart secureagent`
4. เมื่อติดตั้งเสร็จ โปรแกรมจะทำงานเป็นระบบ **TEST** หากต้องการเปลี่ยนจาก test  zone เป็น production zone ให้ใส่ token ที่ไฟล์ /home/secureagent/application-prod.properties และรันคำสั่ง `sudo ./upgrade-to-production.sh` ระบบจะทำการเปลี่ยนเป็น production zone และ restart service ให้พร้อมใช้งานหลังจากรันคำสั่ง

> ไฟล์โปรแกรมจะติดตั้งที่ /home/secureagent/secureagent.jar
> ไฟล์ config token มีสองไฟล์ **(เมื่อแก้ไฟล์แล้วจะต้องทำการ restart service ก่อนถึงจะมีผล)**
> - สำหรับ test --> /home/secureagent/application-test.properties
> - สำหรับ production --> /home/secureagent/application-prod.properties

> ระบบจะ start auto เมื่อบูท linux หากต้องการ manual ให้ใช้คำสั่ง `systemctl start secureagent` `systemctl stop securesagent` `systemctl restart secureagent`
และ `systemctl status secureagent` สำหรับดูสถานะวของโปรแกรม


> การเช็คสถานะการทำงานของ sucureagent ใช้คำสั่ง `systemctl status secureagent` ถ้าระบบทำงานถูกต้องจะแสดง **Active: <span style="color:green">active (running)</span>**
> หรือเข้าผ่านบราวเซอร์ที่ http://localhost:8189/

**หมายเหต** เนื่องจากไฟล์ /home/secureagent/application-test.properties และ /home/secureagent/application-prod.properties เป็นของ user secureagent เวลาแก้ไขจะต้องทำในนาม root (sudo)

## ปัญหาที่พบ
1. `/opt/jdk8u312-b07/bin/java: cannot execute binary file: Exec format` กรณีนี้ติดตั้งบน Ubuntu 18 x64 ซึ่ง kernel เก่าเกินไปไม่รองรับ ให้ใช้ Ubuntu 20 ขึ้นไปครับ

java --add-opens=java.prefs/java.util.prefs=ALL-UNNAMED -Dspring.profiles.active=test -jar secureagent-1.1.2.jar