import mysql.connector
from dotenv import load_dotenv

load_dotenv()
import os

def get_connection():
    return mysql.connector.connect(
        host=os.getenv('HOST'),
        user=os.getenv('USERNAME'),
        password=os.getenv('PASSWORD'),
        database=os.getenv('DATABASE')
    )

connection = mysql.connector.connect(
  host=os.getenv('HOST'),
  user=os.getenv('USERNAME'),
  password=os.getenv('PASSWORD'),
  database=os.getenv('DATABASE')
)

db_cursor = connection.cursor()
