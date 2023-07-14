"""
    This initiallizes the requirements needed
    Some copypasted code from documentations
"""

from airflow import DAG
from airflow.decorators import task
from datetime import datetime
import logging
from airflow.providers.postgres.hooks.postgres import PostgresHook

log = logging.getLogger(__name__)
DAG_ID = "test_imports_v11"

with DAG(
    dag_id=DAG_ID,
    start_date=datetime(2023, 7, 5),
    schedule="@once",
    catchup=False,
) as dag:
    @task(
        task_id="get_data",
    )
    def get_data():
        import sys
        print(sys.executable)
        print(sys.path)
        import selenium
        print(selenium.__version__)
        import pandas as pd
        print(pd.__version__)
        import pyspark
        print(pyspark.__version__)

    data_get = get_data()