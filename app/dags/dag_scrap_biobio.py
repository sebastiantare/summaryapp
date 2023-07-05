import requests
import pandas as pd
import requests
from bs4 import BeautifulSoup
import time
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By

import os
from airflow import DAG
from airflow.providers.postgres.operators.postgres import PostgresOperator
from datetime import datetime

DAG_ID = "daf_scrap_biobio"

with DAG(
    dag_id=DAG_ID,
    start_date=datetime(2023, 7, 4),
    schedule="0 8 * * *",
    catchup=False,
) as dag:
    pass

# Launch Chrome browser in headless mode
options = webdriver.ChromeOptions()
options.add_argument("headless")

browser = webdriver.Chrome(options=options)
browser2_links = webdriver.Chrome(options=options)

def getNewsInfo(link_href):
    browser2_links.get(link_href)
    WebDriverWait(browser2_links, 30).until(is_ready)
    element = browser2_links.find_element(By.CLASS_NAME, 'post')
    id_post = str(element.get_property('id')).split('-')[1]
    XPATH_article = f'//*[@id="post-{id_post}"]'
    element = browser2_links.find_element(By.XPATH, XPATH_article)
    post_image = element.find_element(By.CLASS_NAME, 'post-image')
    post_header = element.find_element(By.CLASS_NAME, 'post-excerpt')
    print(post_header.text)
    
    with open(f'image_{id_post}', 'wb') as file:
        file.write(post_image.screenshot_as_png)
        
    elements = element.find_elements(By.CLASS_NAME, f'banners-contenido-nota-{id_post} > p,h2')
    i=0
    for e in elements:
        i+=1
        print(i, e.text)


def scrapData():
    # Load web page
    browser.get("https://www.biobiochile.cl/lista/categorias/nacional")
                
    # Network transport takes time. Wait until the page is fully loaded
    def is_ready(browser):
        return browser.execute_script(r"""
            return document.readyState === 'complete'
        """)

    WebDriverWait(browser, 30).until(is_ready)

    for i in range(2):
        # Execute fetch function
        browser.execute_script("fetch()")
        time.sleep(1)
        WebDriverWait(browser, 30).until(is_ready)

        # Search for news headlines and print
        elements = browser.find_elements(By.XPATH, "/html/body/main/div/section/div[2]/div[2]/div/article")
        tags = browser.find_elements(By.TAG_NAME, 'a')
        #for tag in tags:
            #if 'noticias/nacional/chile/' in str(tag.get_attribute("href")):
                #print(tag.get_attribute("href"))
        for elem in elements:
            print(elem.find_element(By.CLASS_NAME, 'article-title').text)
            print(elem.find_elements(By.TAG_NAME, 'a')[0].get_attribute('href'))
            getNewsInfo(str(elem.find_elements(By.TAG_NAME, 'a')[0].get_attribute('href'))) 