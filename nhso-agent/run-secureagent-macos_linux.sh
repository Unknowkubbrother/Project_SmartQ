#!/bin/bash

# เปลี่ยน path ให้ตรงกับไฟล์ jar ของคุณ
JAR_PATH="./secureagent-1.1.2.jar"

# รัน Java ด้วย spring profile test และเปิด module java.prefs
java --add-opens=java.prefs/java.util.prefs=ALL-UNNAMED \
     -Dspring.profiles.active=prod \
     -jar "$JAR_PATH"

