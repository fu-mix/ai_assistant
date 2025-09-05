import axios from 'axios'
import type { Messages } from './Main'

export const postChatAI = async (
  message: Messages[],
  apiKey: string,
  systemPrompt: string
): Promise<string> => {
  const API_ENDPOINT = `${import.meta.env.VITE_AI_API_ENDPOINT}`

  try {
    const response = await axios.post(
      API_ENDPOINT,
      {
        contents: [...message],
        // ★ ここで system_instruction を付与
        system_instruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

    if (response.status !== 200) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const resData: string = response.data.candidates[0].content.parts[0].text

    return resData
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}
