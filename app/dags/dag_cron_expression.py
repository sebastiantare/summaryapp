from airflow.decorators import dag, task
from datetime import datetime, timedelta

default_args = {
    'owner': 'stare',
    'retries': 5,
    'retry_delay': timedelta(minutes=5)
}

@dag(dag_id='dag_cron_expression',
     default_args=default_args,
     start_date=datetime(2023,6,29),
     schedule_interval='5 4 * * Tue-Fri'
     )
def hello_world_etl():

    @task(multiple_outputs=True)
    def get_name():
        return {
            'name': 'Jerry',
            'last_name': 'Fridman'
        }
    @task()
    def get_age():
        return 20
    
    @task()
    def greet(name, last_name, age):
        print(f'Hello {name} {last_name}',
              f"I'm {age} years old")
        
    name_dict = get_name()
    age = get_age()
    greet(name_dict['name'], name_dict['last_name'], age)

greet_dag = hello_world_etl()