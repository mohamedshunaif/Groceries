/**
 * Google Gemini API integration for OCR receipt scanning.
 */

window.scanReceiptWithGemini = async (base64Image, mimeType, apiKey, modelName = 'gemini-2.5-flash') => {
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure it in Settings.');
  }

  // Construct the prompt
  const systemPrompt = `You are a precise receipt OCR parsing assistant. Your task is to analyze the image of a grocery receipt and extract structured data.
  
  Please identify:
  1. The name of the store (e.g. "Supermart", "Stockman", "Fahi Plaza"). Normalize the name if necessary.
  2. The date of the receipt. Look for dates in formats like DD-MM-YY, DD/MM/YYYY, or similar. Format the date as "YYYY-MM-DD" if found, otherwise return null.
  3. The list of items purchased. For each item, extract:
     - description: The exact item name/description (e.g. "Movenpick Greek Style Yogurt 400gm - Plain (T)")
     - quantity: The quantity with its unit if specified (e.g., "1.00 pcs", "0.60 Kg", "1.00 Units"). Look at the line immediately following the item description or on the same line.
     - price: The row total amount next to the item as a number (e.g., 67.00, 13.28). This is the total price for that item line.

  Format the output as a strict JSON object with this exact structure:
  {
    "shop": "Supermart",
    "date": "2026-06-16", // or null if not found
    "items": [
      {
        "description": "Movenpick Greek Style Yogurt 400gm - Plain (T)",
        "quantity": "1.00 pcs",
        "price": 67.00
      },
      ...
    ]
  }

  Do not wrap the response in markdown code blocks or anything else. Return ONLY the raw JSON object.`;

  // Strip base64 headers if present (e.g., "data:image/jpeg;base64,...")
  const base64Data = base64Image.split(',')[1] || base64Image;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(`Gemini API Error: ${errorMessage}`);
    }

    const responseData = await response.json();
    const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('Received empty response from Gemini API.');
    }

    try {
      const parsedData = JSON.parse(generatedText.trim());
      
      // Post-process and normalize data
      if (parsedData.shop) {
        // Capitalize first letter of shop
        parsedData.shop = parsedData.shop.charAt(0).toUpperCase() + parsedData.shop.slice(1);
      } else {
        parsedData.shop = 'Supermart'; // Default fallback
      }

      if (!parsedData.date) {
        // Fallback to current date formatted as YYYY-MM-DD
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = today.getMonth() + 1;
        let dd = today.getDate();
        if (mm < 10) mm = '0' + mm;
        if (dd < 10) dd = '0' + dd;
        parsedData.date = `${yyyy}-${mm}-${dd}`;
      }

      // Ensure price is numeric
      if (Array.isArray(parsedData.items)) {
        parsedData.items = parsedData.items.map(item => ({
          description: item.description || 'Unknown Item',
          quantity: item.quantity || '1.00 pcs',
          price: isNaN(parseFloat(item.price)) ? 0.00 : parseFloat(item.price)
        }));
      }

      return parsedData;
    } catch (parseErr) {
      console.error('Failed to parse Gemini response as JSON. Response text was:', generatedText);
      throw new Error('Failed to parse the Gemini AI response. Please try again.');
    }
  } catch (error) {
    console.error('OCR Request Failed:', error);
    throw error;
  }
};
