import os
from airflow import DAG
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.operators.bash_operator import BashOperator
from datetime import datetime

DAG_ID = "postgres_operator_dag"

with DAG(
    dag_id=DAG_ID,
    start_date=datetime(2023, 2, 2),
    schedule="@once",
    catchup=False,
) as dag:
    
    create_article_table = PostgresOperator(
        task_id="create_article_table",
        postgres_conn_id="conn_postgres_id",
        sql="""
            CREATE TABLE IF NOT EXISTS article (
                "article_hash" TEXT,
                "article_title" TEXT,
                "category" TEXT,
                "publish_date" TIMESTAMP,
                "article_body" TEXT,
                "raw_content" TEXT,
                "source_entity" TEXT,
                "article_link" TEXT,

                "generated_summary" TEXT,
                "negative_score" NUMERIC,
                "importance_score" NUMERIC,

                PRIMARY KEY (article_hash)
            );""",
    )

    create_images_table = PostgresOperator(
        task_id="create_images_table",
        postgres_conn_id="conn_postgres_id",
        sql="""
            CREATE TABLE IF NOT EXISTS header_image (
                "article_hash" TEXT,
                "image_hash" TEXT,
                "article_image" BYTEA,

                PRIMARY KEY (image_hash),
                FOREIGN KEY (article_hash) REFERENCES article (article_hash)
            );""",
    )

    create_article_table >> create_images_table