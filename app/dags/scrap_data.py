"""
    This initiallizes the requirements needed
    Some copypasted code from documentations
"""
import os
from airflow import DAG
from pprint import pprint
from airflow.decorators import task
import shutil
from datetime import datetime
import logging
from airflow.providers.postgres.hooks.postgres import PostgresHook

log = logging.getLogger(__name__)
DAG_ID = "initiallize_python_scrap_data_dag"

with DAG(
    dag_id=DAG_ID,
    start_date=datetime(2023, 7, 5),
    schedule="@once",
    catchup=False,
) as dag:
    """
        Test
    """
    @task(task_id="get_data")
    def get_data():
        import pandas as pd
        print(pd.__version__)
        """# NOTE: configure this as appropriate for your airflow environment
        data_path = "/opt/airflow/dags/files/employees.csv"
        os.makedirs(os.path.dirname(data_path), exist_ok=True)

        url = "https://raw.githubusercontent.com/apache/airflow/main/docs/apache-airflow/tutorial/pipeline_example.csv"

        response = requests.request("GET", url)

        with open(data_path, "w") as file:
            file.write(response.text)

        postgres_hook = PostgresHook(postgres_conn_id="tutorial_pg_conn")
        conn = postgres_hook.get_conn()
        cur = conn.cursor()
        with open(data_path, "r") as file:
            cur.copy_expert(
                "COPY employees_temp FROM STDIN WITH CSV HEADER DELIMITER AS ',' QUOTE '\"'",
                file,
            )
        conn.commit()"""

    data_get = get_data()
