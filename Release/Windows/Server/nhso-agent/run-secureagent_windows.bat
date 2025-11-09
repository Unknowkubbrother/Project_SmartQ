@echo off

set JAR_PATH=%~dp0secureagent-1.1.2.jar

REM รัน Java ด้วย spring profile test และเปิด module java.prefs
java --add-opens=java.prefs/java.util.prefs=ALL-UNNAMED ^
     -Dspring.profiles.active=test ^
     -jar "%JAR_PATH%"

pause
