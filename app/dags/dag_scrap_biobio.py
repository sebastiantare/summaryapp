import time
from datetime import datetime, timedelta
from airflow.decorators import dag, task
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator

"""
0) get last news date
1) scrap latest news
2) visit news
3) insert news data
"""

DAG_ID = "dag_scrap_biobio_v17"

PATH_TO_PYTHON_BINARY = ''
POSTRES_CONN_ID = 'conn_postgres_id'

@dag(
    dag_id=DAG_ID,
    schedule_interval="0 0 * * *",
    start_date=datetime(2023, 1, 1),
    catchup=False,
    dagrun_timeout=timedelta(minutes=10),
)
def ScrapAndStoreData():

    def executeQuery(query):
        try:
            postgres_hook = PostgresHook(postgres_conn_id=POSTRES_CONN_ID)
            conn = postgres_hook.get_conn()
            cur = conn.cursor()
            cur.execute(query)
            records = cur.fetchall()
            conn.commit()
            return records
        except Exception as e:
            return 1

    @task
    def getLastArticleDate():
        data = executeQuery('SELECT article_date FROM article ORDER BY article_date DESC LIMIT 1;')
        print(data)

    """
        "article_hash" TEXT,
        "article_title" TEXT,
        "category" TEXT,
        "publish_date" DATE,
        "article_body" TEXT,
        "raw_content" TEXT,
        "source_entity" TEXT,
        "article_link" TEXT,

        "generated_summary" TEXT,
        "negative_score" NUMERIC,
        "importance_score" NUMERIC,


        "id_post": str(id_post),
        "post_image": post_image.screenshot_as_png,
        
        "body_text": str(body_text),
        "date": str(post_date),
        "raw": str(element_post.get_property('innerHTML'))
        article_data["hash"] = hash_text(link)
        article_data["title"] = title
        article_data["link"] = link
        article_data["category"] = "Nacional"
        article_data["entity"] = "biobiochile.cl"
    """
    def insertNewArticle(data):
        query = """
            INSERT INTO article 
            (
                article_hash, 
                article_title, 
                category, 
                publish_date, 
                article_body, 
                raw_content, 
                source_entity, 
                article_link
            ) 
            VALUES 
            (
                {{ params.hash }}, 
                {{ params.title }},
                {{ params.category }},
                {{ params.date }},
                {{ params.body_text }},
                {{ params.raw }},
                {{ params.entity }},
                {{ params.link}},
            );"""

    @task.external_python(task_id="scrap_data", python=PATH_TO_PYTHON_BINARY)
    def scrapData():
        #import requests
        import dateparser
        from datetime import datetime, timedelta
        #import pandas as pd
        #from bs4 import BeautifulSoup
        import hashlib
        import time
        import pandas as pd
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait

        def writeToDB(df, tname):
            postgres_hook = PostgresHook(postgres_conn_id=POSTRES_CONN_ID)
            df.to_sql(tname, postgres_hook.get_sqlalchemy_engine(), if_exists='replace', chunksize=1000)

        def hash_text(text):
            sha256_hash = hashlib.sha256()
            sha256_hash.update(text.encode('utf-8'))
            hashed_text = sha256_hash.hexdigest()
            return hashed_text

        def is_ready(browser):
            return browser.execute_script(r"""
                return document.readyState === 'complete'
            """)

        options = webdriver.ChromeOptions()
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        #browser = webdriver.Chrome('./chromedriver/',options=options)
        remote_webdriver = 'remote_chromedriver'

        with webdriver.Remote(f'{remote_webdriver}:4444/wd/hub', options=options) as browser:
            print("1) BROWSER OK")
            # Load web page
            browser.get("https://www.biobiochile.cl/lista/categorias/nacional")
            print("2) GET OK")
            button = browser.find_element(By.CLASS_NAME, 'fetch-btn')
            print("3) BUTTON OK")
            # Date A: Now
            # Date B: Reference, example: Now - 24h, or, Last post date
            date_A = datetime.now()
            date_B = date_A - timedelta(hours=3)
            # TODO: Query last post date

            while(date_A > date_B):
                # Execute fetch/click function
                browser.execute_script("arguments[0].click();", button)   
                print("4) CLICK OK") 

                # Wait to load
                time.sleep(1)
                WebDriverWait(browser, 30).until(is_ready)

                # Search news
                elements = browser.find_elements(By.XPATH, "/html/body/main/div/section/div[2]/div[2]/div/article")
                print("5) FETCH OK") 

                # Fetched items are loaded in a different list
                fetch_elements = browser.find_elements(By.XPATH, "/html/body/main/div/section/div[2]/div[2]/div/div/div[1]/div")
                print("6) FETCH 2 OK") 
                
                # Get last fetched post datetime
                date_A = dateparser.parse(str(fetch_elements[len(fetch_elements)-1].find_element(By.CLASS_NAME, 'article-date-hour').text))

                articles = []

                df = None

                if (date_A <= date_B):
                    print("Loading data...")
                    full_elements = elements + fetch_elements
                    for elem in full_elements:
                        # title
                        title = str(elem.find_element(By.CLASS_NAME, 'article-title').text)
                        # link
                        link = str(elem.find_elements(By.TAG_NAME, 'a')[0].get_attribute('href'))
                        # date
                        #date_post = dateparser.parse(str(elem.find_element(By.CLASS_NAME, 'article-date-hour').text))

                        # visit link and get news body text
                        #article_data = getNewsInfo(str(elem.find_element(By.TAG_NAME, 'a').get_attribute('href')))
                        article_data = {}
                        article_data["article_hash"] = hash_text(link)
                        article_data["article_title"] = title
                        article_data["article_link"] = link
                        article_data["category"] = "Nacional"
                        article_data["source_entity"] = "biobiochile.cl"
                        articles.append(article_data)
                    df = pd.DataFrame(full_elements)
            browser.close()
        return df

    """
                def getNewsInfo(link_href):
                with webdriver.Remote(f'{remote_webdriver}:4444/wd/hub', options=options) as browser_links:
                    #browser2_links = webdriver.Chrome(options=options)
                    browser_links.get(link_href)
                    print('Access', link_href)
                    time.sleep(1)
                    WebDriverWait(browser_links, 30).until(is_ready)
                    element_post = browser_links.find_element(By.CLASS_NAME, 'post')

                    # Biobio has different class for every post with its ID
                    id_post = str(element_post.get_property('id')).split('-')[1]
                    print('POST ID', id_post)
                    XPATH_article = f'//*[@id="post-{id_post}"]'
                    element = browser_links.find_element(By.XPATH, XPATH_article)
                    print('ELEM ', element)

                    # Header image
                    post_image = element.find_element(By.CLASS_NAME, 'post-image')
                    print('IMG', element)

                    # Biobio has a header with part of the text separated of the rest
                    post_header = element.find_element(By.CLASS_NAME, 'post-excerpt')
                    print('HEADER', str(post_header.text))

                    # Date
                    post_date = dateparser.parse(str(element.find_element(By.CLASS_NAME, 'post-date').text))
                    print('DATE', post_date)

                    # print(post_header.text)
                    # with open(f'image_{id_post}', 'wb') as file:
                    #    file.write(post_image.screenshot_as_png)

                    # Get the rest of the body text
                    body_text = str(post_header.text)
                    elements = element.find_elements(
                        By.CLASS_NAME, f'banners-contenido-nota-{id_post} > p,h2')

                    for e in elements:
                        body_text = body_text + ' ' + str(e.text)

                    browser_links.close()
                    print('SCRAPPED:', str(body_text))

                return {
                    "id_post": str(id_post),
                    "post_image": post_image.screenshot_as_png,
                    "body_text": str(body_text),
                    "date": str(post_date),
                    "raw": str(element_post.get_property('innerHTML'))
                }
                """


    @task
    def initializeTask():
        print(DAG_ID, 'running...')

    initializeTask() >> scrapData()

ScrapAndStoreData()