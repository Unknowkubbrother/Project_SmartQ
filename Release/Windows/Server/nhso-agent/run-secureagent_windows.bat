@echo off

set JAR_PATH=%~dp0secureagent-1.1.2.jar

REM
java --add-opens=java.prefs/java.util.prefs=ALL-UNNAMED ^
     -Dspring.profiles.active=prod ^
     -jar "%JAR_PATH%"

pause
