import os
from airflow import DAG
from airflow.providers.postgres.operators.postgres import PostgresOperator
from datetime import datetime

DAG_ID = "postgres_operator_dag"

with DAG(
    dag_id=DAG_ID,
    start_date=datetime(2023, 2, 2),
    schedule="@once",
    catchup=False,
) as dag:
    create_news_table = PostgresOperator(
        task_id="create_news_table",
        postgres_conn_id="conn_postgres_id",
        sql="""
            CREATE TABLE IF NOT EXISTS news (
                "hash" TEXT,
                "title" TEXT,
                "category" TEXT,
                "date" DATE,
                "body" TEXT,
                "raw_content" TEXT,
                "source_entity" TEXT,
                "link" TEXT,

                "generated_summary" TEXT,
                "negative_score" NUMERIC,
                "importance_score" NUMERIC,

                PRIMARY KEY (hash)
            );""",
    )

    create_images_table = PostgresOperator(
        task_id="create_images_table",
        postgres_conn_id="conn_postgres_id",
        sql="""
            CREATE TABLE IF NOT EXISTS news_image (
                "hash" TEXT,
                "image_hash" TEXT,
                "image" BYTEA,

                PRIMARY KEY (image_hash),
                FOREIGN KEY (hash) REFERENCES news (hash)
            );""",
    )