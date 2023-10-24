FROM apache/airflow:2.6.2
USER root

USER airflow

COPY ./requirements.txt /
RUN pip install -r /requirements.txt
RUN pip install torch==1.9.0+cpu torchvision==0.10.0+cpu torchaudio==0.9.0 -f https://download.pytorch.org/whl/torch_stable.html
RUN pip install 'transformers[torch]'