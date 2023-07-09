FROM apache/airflow:2.6.2

USER airflow
ENV PATH="/chromedriver:${PATH}"
COPY requirements.txt /requirements.txt
RUN pip install --user --upgrade pip
RUN pip install --no-cache-dir --user -r /requirements.txt