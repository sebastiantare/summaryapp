def summarizer(article):
    import torch
    from transformers import BertTokenizerFast, EncoderDecoderModel
    import pandas as pd
    import numpy as np
    import gc

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    ckpt = 'mrm8488/bert2bert_shared-spanish-finetuned-summarization'
    tokenizer = BertTokenizerFast.from_pretrained(ckpt)
    model = EncoderDecoderModel.from_pretrained(ckpt).to(device)

    def generate_summary(text):
        inputs = tokenizer([text], padding="max_length", truncation=True, max_length=512, return_tensors="pt")
        input_ids = inputs.input_ids.to(device)
        attention_mask = inputs.attention_mask.to(device)
        output = model.generate(input_ids, attention_mask=attention_mask)
        return tokenizer.decode(output[0], skip_special_tokens=True)

    def getChunks(article):
        parts = article.split('.')
        df = pd.DataFrame(parts)
        df.columns = ['article_parts']
        df = df[df['article_parts'].str.len() > 0]
        return df.to_numpy().squeeze()

    def mergeChunks(number, chunks):
        import math

        # Calculate the number of splits
        splits = math.ceil((len(chunks) / number) - 0.5)

        # Create an empty result list to store merged chunks
        result = []

        # Loop through and merge the chunks
        for i in range(splits):
            start = i * number
            end = min((i + 1) * number, len(chunks))
            chunk = chunks[start:end]
            merged_chunk = ". ".join(chunk)
            result.append(merged_chunk)

        return result
    
    """
    Split the article into chunks.
    Chunks are divided by the text splitted with dots.
    This helps so that we don't separate important data, context, etc.
    This helps the model generate better summaries.
    That can I later format into bulletpoints.
    """
    chunks = getChunks(article)

    chunk_size = int(len(article)/390) # Modify this for improving summarizer results

    merged_chunks = mergeChunks(chunk_size, chunks)


