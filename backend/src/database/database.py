import mysql.connector
from src.config.config import get as config

connection = mysql.connector.connect(
  host=config('DB.HOST'),
  user=config('DB.USERNAME'),
  password=config('DB.PASSWORD'),
  database=config('DB.DATABASE')
)

db_cursor = connection.cursor()
