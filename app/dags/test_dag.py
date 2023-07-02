from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

defaut_args = {
    'owner': 'stare',
    'retries': 5,
    'retry_delay': timedelta(minutes=2)
}

with DAG(
    dag_id='test_dag_v6',
    default_args=defaut_args,
    description='Testing airflow dags',
    start_date=datetime(2023, 6, 29, 2),
    schedule_interval='@daily'
) as dag:
    task1 = BashOperator(
        task_id='test_task',
        bash_command="python --version"
    )

    task2 = BashOperator(
        task_id='second_task',
        bash_command="whereis python"
    )

    task3 = BashOperator(
        task_id='third_task',
        bash_command="echo 000"
    )

    
    #task1.set_downstream(task2)
    #task1.set_downstream(task3)

    #task1 >> task2
    #task1 >> task3

    task1 >> [task2, task3]
