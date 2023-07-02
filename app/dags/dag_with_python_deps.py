from airflow.decorators import dag, task
from datetime import datetime, timedelta

import os
import sys
from pprint import pprint
import sklearn

default_args = {
    'owner': 'stare',
    'retries': 5,
    'retry_delay': timedelta(minutes=5)
}

@dag(dag_id='dag_python_deps_NEW7',
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
    @task(task_id="print_the_context")
    def print_context(ds=None, **kwargs):
        """Print the Airflow context and ds variable from the context."""
        pprint(kwargs)

        print(os.path.dirname(sys.executable))
        pprint(sys.path)
        print(sklearn.__version__)
        print(ds)
        return "Whatever you return gets printed in the logs"
        
    @task()
    def greet(name, last_name, age):
        print(f'Hello {name} {last_name}',
              f"I'm {age} years old")
        
    name_dict = get_name()
    age = print_context()
    greet(name_dict['name'], name_dict['last_name'], age)

greet_dag = hello_world_etl()