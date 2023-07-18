import time
from datetime import datetime, timedelta
from airflow.decorators import dag, task
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.operators.bash_operator import BashOperator

"""
0) get last news date
1) scrap latest news
2) visit news
3) insert news data
"""

DAG_ID = "dag_scrap_biobio_v1.0"

PATH_TO_PYTHON_BINARY = ''
POSTRES_CONN_ID = 'conn_postgres_id'
DATA_JSON_PATH = '/opt/airflow/to_postgres.json'

@dag(
    dag_id=DAG_ID,
    schedule_interval="@hourly",
    start_date=datetime(2023, 1, 1),
    catchup=False,
    dagrun_timeout=timedelta(minutes=10),
)
def ScrapAndStoreData():
    postgres_hook = PostgresHook(postgres_conn_id=POSTRES_CONN_ID)

    @task.virtualenv(
        task_id="virtualenv_python", requirements=["selenium", "pandas", "dateparser"], system_site_packages=True
    )
    def installRequirements():
        import selenium
        import pandas
        import dateparser
        print(selenium.__version__)
        print(pandas.__version__)
        print(dateparser.__version__)

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
    def writeToDB():
        import pandas as pd
        try:
            df = pd.read_json(DATA_JSON_PATH)
            print(df.head())
            df.to_sql('article', postgres_hook.get_sqlalchemy_engine(), if_exists='append', chunksize=1000, index=False)
        except Exception as e:
            print('Error reading file, or is empty', e)
            return
        

    @task
    def getLastArticleDate(**kwargs):
        ti = kwargs["ti"]

        data = executeQuery('SELECT publish_date FROM article ORDER BY publish_date desc limit 1;')

        print('Last Publish Date: ', data)

        last_date = None

        if len(data) > 0:
            last_date = data[0][0]
        else:
            now = datetime.now()
            last_date = now - timedelta(hours=24)

        ti.xcom_push(key='last_date', value=last_date)
        return last_date

    @task
    def completeScrapData(**kwargs):
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

        ti = kwargs["ti"]
        last_date = dateparser.parse(str(ti.xcom_pull(task_ids="getLastArticleDate", key="last_date")))
        last_date = last_date.replace(tzinfo=None)
        print('Last Article Date:', last_date)

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
        remote_webdriver = 'remote_chromedriver'

        def scrapData():
            with webdriver.Remote(f'{remote_webdriver}:4444/wd/hub', options=options) as browser:
                print("1) BROWSER OK")
                # Load web page
                browser.get("https://www.biobiochile.cl/lista/categorias/nacional")
                print("2) GET OK")
                button = browser.find_element(By.CLASS_NAME, 'fetch-btn')
                print("3) BUTTON OK")

                upper_date = datetime.now()

                while(upper_date > last_date):
                    # Execute fetch/click function
                    browser.execute_script("arguments[0].click();", button)   
                    print("4) CLICK OK") 

                    # Wait to load
                    time.sleep(3)
                    WebDriverWait(browser, 100).until(is_ready)

                    # Search news
                    elements = browser.find_elements(By.XPATH, "/html/body/main/div/section/div[2]/div[2]/div/article")
                    print("5) FETCH OK") 

                    # Fetched items are loaded in a different list
                    fetch_elements = browser.find_elements(By.XPATH, "/html/body/main/div/section/div[2]/div[2]/div/div/div[1]/div")
                    print("6) FETCH 2 OK") 
                    
                    # Get last fetched post datetime
                    lower_batch_date = dateparser.parse(str(fetch_elements[len(fetch_elements)-1].find_element(By.CLASS_NAME, 'article-date-hour').text))

                    upper_date = lower_batch_date

                    articles = []

                    df = None

                    print("Loading data...")
                    full_elements = elements + fetch_elements
                    for elem in full_elements:
                        date_post = dateparser.parse(str(elem.find_element(By.CLASS_NAME, 'article-date-hour').text))
                        if (date_post <= last_date):
                            # Last date post reached, all the rest are already stored
                            break
                        # title
                        title = str(elem.find_element(By.CLASS_NAME, 'article-title').text)
                        # link
                        link = str(elem.find_elements(By.TAG_NAME, 'a')[0].get_attribute('href'))
                        # date
                        # visit link and get news body text
                        #article_data = getNewsInfo(str(elem.find_element(By.TAG_NAME, 'a').get_attribute('href')))
                        article_data = {}
                        article_data["article_hash"] = hash_text(link)
                        article_data["article_title"] = title
                        article_data["article_link"] = link
                        article_data["category"] = "Nacional"
                        article_data["source_entity"] = "biobiochile.cl"
                        articles.append(article_data)
                    print('Data into DataFrame')
                    df = pd.DataFrame(articles)
                    print(df.head())
                browser.close()
            return df

        def scrapDataSecondPhase(df):
            new_df = None
            articles = []

            class Generic():
                pass

            with webdriver.Remote(f'{remote_webdriver}:4444/wd/hub', options=options) as browser_links:
                for index, article in df.iterrows():
                    try:
                        #browser2_links = webdriver.Chrome(options=options)
                        browser_links.get(article['article_link'])
                        print('Access', article['article_link'])
                        time.sleep(3)
                        WebDriverWait(browser_links, 100).until(is_ready)
                        element_post = None

                        if 'aqui-tierra' in article['article_link']:
                            """
                            ###################################################################
                                A different format for the article of type "aqui-tierra"
                            """
                            try:
                                element_post = browser_links.find_element(By.CLASS_NAME, 'nota-y-mas-leidos')
                            except Exception as e:
                                print('Error Aqui-tierra', e)
                                break

                            # Biobio has different class for every post with its ID
                            #id_post = str(element_post.get_property('id')).split('-')[1]

                            #print('POST ID', id_post)
                            #XPATH_article = f'//*[@id="post-{id_post}"]'
                            #element = browser_links.find_element(By.XPATH, XPATH_article)
                            #print('ELEM ', element)

                            # Header image
                            #post_image = element.find_element(By.CLASS_NAME, 'post-image')
                            #print('IMG')

                            # Biobio has a header with part of the text separated of the rest
                            post_header = Generic()
                            setattr(post_header, 'text', "")
                            try:
                                post_header = element_post.find_element(By.CLASS_NAME, 'extracto-nota')
                            except:
                                # Sometimes it's missing
                                pass
                            print('HEADER', str(post_header.text))

                            # Date
                            try:
                                post_date = dateparser.parse(str(element_post.find_element(By.CSS_SELECTOR, '.autorcitos > p:nth-child(3)').text).replace('Publicado a las ', ''))
                                print('DATE', post_date)
                            except:
                                print('ERROR PARSING DATE', str(element_post.find_element(By.CSS_SELECTOR, '.autorcitos > p:nth-child(3)').text))
                                continue

                            # print(post_header.text)
                            # with open(f'image_{id_post}', 'wb') as file:
                            #    file.write(post_image.screenshot_as_png)

                            # Get the rest of the body text
                            body_text = str(post_header.text)
                            elements = element_post.find_elements(By.CLASS_NAME, 'banners-contenido-nota > p,h2')

                            # Make body
                            for e in elements:
                                body_text = body_text + ' ' + str(e.text)

                            print('Elements: ', len(elements))

                            #"post_image": post_image.screenshot_as_png,
                            #"id_post": str(id_post),
                            article_data = {
                                "article_hash": article['article_hash'],
                                "article_body": str(body_text),
                                "publish_date": str(post_date),
                                "raw_content": str(element_post.get_property('innerHTML'))
                            }
                        elif 'especial' in article['article_link']:
                            """
                            ###################################################################
                                A different format for the article of type "nota"
                            """
                            try:
                                element_post = browser_links.find_element(By.CLASS_NAME, 'nota-y-mas-leidos')
                            except Exception as e:
                                print('Error Nota', e)
                                break

                            # Biobio has different class for every post with its ID
                            #id_post = str(element_post.get_property('id')).split('-')[1]

                            #print('POST ID', id_post)
                            #XPATH_article = f'//*[@id="post-{id_post}"]'
                            #element = browser_links.find_element(By.XPATH, XPATH_article)
                            #print('ELEM ', element)

                            # Header image
                            #post_image = element.find_element(By.CLASS_NAME, 'post-image')
                            #print('IMG')

                            # Biobio has a header with part of the text separated of the rest
                            post_header = Generic()
                            setattr(post_header, 'text', "")
                            try:
                                post_header = element_post.find_element(By.CLASS_NAME, 'extracto-nota')
                            except:
                                # Sometimes it's missing
                                pass
                            print('HEADER', str(post_header.text))

                            # Date
                            try:
                                post_date = dateparser.parse(str(element_post.find_element(By.CLASS_NAME, 'fecha').text))
                                print('DATE', post_date)
                            except:
                                print('ERROR PARSING DATE', str(element_post.find_element(By.CLASS_NAME, 'fecha').text))
                                continue

                            # print(post_header.text)
                            # with open(f'image_{id_post}', 'wb') as file:
                            #    file.write(post_image.screenshot_as_png)

                            # Get the rest of the body text
                            body_text = str(post_header.text)
                            elements = element_post.find_elements(By.CLASS_NAME, 'banners-contenido-nota > p,h2')

                            # Make body
                            for e in elements:
                                body_text = body_text + ' ' + str(e.text)

                            print('Elements: ', len(elements))

                            #"post_image": post_image.screenshot_as_png,
                            #"id_post": str(id_post),
                            article_data = {
                                "article_hash": article['article_hash'],
                                "article_body": str(body_text),
                                "publish_date": str(post_date),
                                "raw_content": str(element_post.get_property('innerHTML'))
                            }

                        else:
                            """
                            ###################################################################
                                NORMAL ARTICLE FORMAT
                            """
                            element_post = browser_links.find_element(By.CLASS_NAME, 'post')

                            # Biobio has different class for every post with its ID
                            id_post = str(element_post.get_property('id')).split('-')[1]

                            print('POST ID', id_post)
                            XPATH_article = f'//*[@id="post-{id_post}"]'
                            element = browser_links.find_element(By.XPATH, XPATH_article)
                            print('ELEM ', element)

                            # Header image
                            #post_image = element.find_element(By.CLASS_NAME, 'post-image')
                            #print('IMG')

                            # Biobio has a header with part of the text separated of the rest
                            post_header = Generic()
                            setattr(post_header, 'text', "")
                            try:
                                post_header = element.find_element(By.CLASS_NAME, 'post-excerpt')
                            except:
                                pass
                            print('HEADER', str(post_header.text))

                            # Date
                            post_date = dateparser.parse(str(element.find_element(By.CLASS_NAME, 'post-date').text))
                            print('DATE', post_date)

                            # print(post_header.text)
                            # with open(f'image_{id_post}', 'wb') as file:
                            #    file.write(post_image.screenshot_as_png)

                            # Get the rest of the body text
                            body_text = str(post_header.text)
                            elements = element.find_elements(By.CLASS_NAME, f'banners-contenido-nota-{id_post} > p,h2')

                            # Make body
                            for e in elements:
                                body_text = body_text + ' ' + str(e.text)

                            print('Elements: ', len(elements))

                            #"post_image": post_image.screenshot_as_png,
                            #"id_post": str(id_post),
                            article_data = {
                                "article_hash": article['article_hash'],
                                "article_body": str(body_text),
                                "publish_date": str(post_date),
                                "raw_content": str(element_post.get_property('innerHTML'))
                            }
                        articles.append(article_data)
                    except Exception as e:
                        print("Error in ScrapDataSecondPhase: ", e)

                # End For
                browser_links.close()
                print('Articles Total:', len(articles))

            # End Web Scrapping
            new_df = pd.DataFrame(articles)
            print(new_df.head())
            if len(articles) == 0:
                return None
            return pd.merge(df, new_df, how='left', on='article_hash')
        
        data = scrapData()
        data = scrapDataSecondPhase(data)
        
        if data is None:
            return None

        #writeToDB(data, 'article')
        # Save JSON data to a file
        with open(DATA_JSON_PATH, 'w') as json_file:
            json_data = data.to_json(orient='records')
            json_file.write(json_data)

        return data.shape

    @task
    def initializeTask():
        print(DAG_ID, 'running...')

    @task
    def finalizeTask():
        print(DAG_ID, 'finishing...')

    initializeTask() >> getLastArticleDate() >> completeScrapData() >> writeToDB() >> finalizeTask()

ScrapAndStoreData()