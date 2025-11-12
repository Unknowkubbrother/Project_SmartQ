#!/bin/bash

JAR_PATH="./secureagent-1.1.2.jar"

java --add-opens=java.prefs/java.util.prefs=ALL-UNNAMED \
     -Dspring.profiles.active=prod \
     -jar "$JAR_PATH"

