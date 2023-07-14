from __future__ import annotations

import datetime

import pendulum

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.empty import EmptyOperator

with DAG(
    dag_id="bash_dag_test",
    schedule="0 0 * * *",
    start_date=pendulum.datetime(2023, 1, 1, tz="UTC"),
    catchup=False,
    dagrun_timeout=datetime.timedelta(minutes=10),
) as dag:
    java_test = BashOperator(
        task_id="java_home_test",
        append_env=True,
        bash_command='echo $JAVA_HOME',
    )

    path_test = BashOperator(
        task_id="path_test",
        append_env=True,
        bash_command='echo $PATH',
    )

    java_test >> path_test