using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Serialization;


namespace DeepSeekAzure.Controllers
{
    [ApiController]
    [Route("v1/[controller]")]
    public class OpenAIController : ControllerBase
    {
        /// <summary>
        /// Call Azure AI Foundry API to get completions.
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        [HttpPost("completions")]
        public async Task<IActionResult> Completions([FromBody] MessagesRequest request)
        {
            // Validate request
            if (request.Messages == null || request.Messages.Count == 0)
            {
                return BadRequest(new { error = "Prompt is required." });
            }

            using var httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromMinutes(5)
            };
            Console.WriteLine("HttpClient timeout set to 5 minutes.");
            httpClient.DefaultRequestHeaders.Add("api-key", "xxx");

            var payload = new
            {
                messages = request.Messages,
                max_tokens = 1000,
                model = "DeepSeek-R1"
            };

            var jsonPayload = JsonSerializer.Serialize(payload);
            var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");

            Console.WriteLine("Payload sent to API: " + jsonPayload);
            var apiResponse = await httpClient.PostAsync("https://xxx.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview", content);

            if (!apiResponse.IsSuccessStatusCode)
            {
                //return StatusCode((int)apiResponse.StatusCode, new { error = "Failed to call external API." });
                var responseContentTest = await apiResponse.Content.ReadAsStringAsync();
                Console.WriteLine("Error response from API: " + responseContentTest);
                return Content(responseContentTest, "application/json");
            }

            var responseContent = await apiResponse.Content.ReadAsStringAsync();
            return Content(responseContent, "application/json");
        }
    }

    public class MessagesRequest
    {
        public List<Message> Messages { get; set; }
    }

    public class Message
    {
        [JsonPropertyName("role")]
        public string Role { get; set; }

        [JsonPropertyName("content")]
        public string Content { get; set; }
    }


    public class CompletionResponse
    {
        public string Id { get; set; }
        public string Object { get; set; }
        public long Created { get; set; }
        public string Model { get; set; }
        public Choice[] Choices { get; set; }
        public Usage Usage { get; set; }
    }

    public class Choice
    {
        public string Text { get; set; }
        public int Index { get; set; }
        public object Logprobs { get; set; }
        public string FinishReason { get; set; }
    }

    public class Usage
    {
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public int TotalTokens { get; set; }
    }
}
