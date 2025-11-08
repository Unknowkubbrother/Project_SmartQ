import mysql.connector
from mysql.connector import Error
from src.config.config import get as config

connection = None
db_cursor = None

try:
  connection = mysql.connector.connect(
    host=config('DB.HOST'),
    user=config('DB.USERNAME'),
    password=config('DB.PASSWORD'),
    database=config('DB.DATABASE'),
    autocommit=True
  )
  db_cursor = connection.cursor()
except Error as e:
  print(f"Database connection error: {e}")
