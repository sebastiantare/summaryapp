from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

defaut_args = {
    'owner': 'stare',
    'retries': 5,
    'retry_delay': timedelta(minutes=2)
}

with DAG(
    dag_id='catchup_and_backfill_2',
    default_args=defaut_args,
    description='Testing catchup and backfill',
    start_date=datetime(2023, 6, 28, 2),
    schedule_interval='@daily',
    catchup=False
) as dag:
    task1 = BashOperator(
        task_id='test_task',
        bash_command="echo hello world, this is a test task!"
    )

    task2 = BashOperator(
        task_id='second_task',
        bash_command="echo second task run after the first one"
    )

    task3 = BashOperator(
        task_id='third_task',
        bash_command="echo hey, this is task3 and I run after task 1"
    )

    task1
