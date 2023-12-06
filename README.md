# Summaryapp (tentative)

<div align="center">
<pre>
  News articles summarizer App to waste less time reading news and avoid clickbait/scroll-through-ads articles.
</pre>

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)

</div>

## Project Progression ![](https://geps.dev/progress/40)
1. Scrape & store news articles with Airflow. ✅
2. Generate bulletpoints summaries & negativity score with two LLM. ✅
3. Make a simple webpage for email subscription to the service and news configuration.
4. Create service for automating sending emails to the registered clients.
5. Evaluate costs & Upload the models to a cloud service to be accessed through the API.

## Description
A personal project for summarizing local news due to the lack of actual content, and the interest of having users read through lot of Ads means longer articles without relevant information. So I thought on scrapping all data and summarizing it with a LLM model for summarization, and also filtering articles with a Sentiment analysis model to remove the bad news (murder, crime, etc), and also rank news on importance, reducing time spent on reading news, quality of readed content, and awareness of bad practices from news publishers.

## Contributing

1. Fork it (<https://github.com/sebastiantare/summaryapp/fork>)
2. Create your feature branch (`git checkout -b feature/otherNewsScrap`)
3. Commit your changes (`git commit -am 'Add scrap logic for another news articles'`)
4. Push to the branch (`git push origin feature/otherNewsScrap`)
5. Create a new Pull Request
