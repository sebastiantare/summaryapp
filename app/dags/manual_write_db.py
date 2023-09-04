import time
from datetime import datetime, timedelta
from airflow.decorators import dag, task
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.operators.bash_operator import BashOperator

"""
0) get last news date
1) scrap latest news
2) visit news
3) insert news data
"""

DAG_ID = "manual_write_json_db"

PATH_TO_PYTHON_BINARY = ''
POSTRES_CONN_ID = 'conn_postgres_id'
DATA_JSON_PATH = '/opt/airflow/to_postgres.json'

@dag(
    dag_id=DAG_ID,
    schedule_interval="@hourly",
    start_date=datetime(2023, 1, 1),
    catchup=False,
    dagrun_timeout=timedelta(minutes=10)
)
def ManualWrite():
    postgres_hook = PostgresHook(postgres_conn_id=POSTRES_CONN_ID)

    @task
    def writeToDB():
        import pandas as pd
        try:
            df = pd.read_json(DATA_JSON_PATH)
            print(df.head())
            df.to_sql('article', postgres_hook.get_sqlalchemy_engine(), if_exists='append', chunksize=1000, index=False)
        except Exception as e:
            print('Error reading file, or is empty', e)
            return

    @task
    def initializeTask():
        print(DAG_ID, 'running...')

    @task
    def finalizeTask():
        print(DAG_ID, 'finishing...')

    initializeTask() >> writeToDB() >> finalizeTask()

ManualWrite()