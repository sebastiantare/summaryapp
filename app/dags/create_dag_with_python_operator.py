from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

defaut_args = {
    'owner': 'stare',
    'retries': 5,
    'retry_delay': timedelta(minutes=5)
}

def greet(ti):
    name = ti.xcom_pull(task_ids='get_name', key='first_name')
    last_name = ti.xcom_pull(task_ids='get_name', key='last_name')
    age = ti.xcom_pull(task_ids='get_age', key='age')
    print('Hello this is a test', name, last_name, age)

def get_name(ti):
    ti.xcom_push(key='first_name', value='Jerry')
    ti.xcom_push(key='last_name', value='Fridman')

def get_age(ti):
    ti.xcom_push(key='age', value='20 years')

with DAG(
    dag_id='dag_python_operador_06',
    default_args=defaut_args,
    description='Python operator DAG',
    start_date=datetime(2023, 6, 28, 2),
    schedule_interval='@daily'
) as dag:
    
    task1 = PythonOperator(
        task_id='greet',
        python_callable=greet
    )

    task2 = PythonOperator(
        task_id='get_name',
        python_callable=get_name,
    )


    task3 = PythonOperator(
        task_id='get_age',
        python_callable=get_age,
    )

    [task2, task3] >> task1
