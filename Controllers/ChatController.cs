using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DeepSeekAzure.Controllers
{
    [ApiController]
    [Route("openai/deployments/deepseek/[controller]")]
    public class ChatController : ControllerBase
    {
        /// <summary>
        /// Call Azure AI Foundry API to get completions.
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        [HttpPost("completions")]
        public async Task<IActionResult> Completions([FromBody] AICompletionRequest request)
        {
            // Validate request
            if (request.Messages == null || request.Messages.Count == 0)
            {
                return BadRequest(new { error = "Prompt is required." });
            }

            var endpoint = "https://xxx.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview";
            var apikey = "xxx";

            using var httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromMinutes(5)
            };

            httpClient.DefaultRequestHeaders.Add("api-key", apikey);

            var payload = new
            {
                messages = request.Messages,
                max_tokens = request.MaxTokens > 0 ? request.MaxTokens : 100,
                model = !string.IsNullOrEmpty(request.Model) ? request.Model : "DeepSeek-R1",
                frequency_penalty = request.FrequencyPenalty != 0 ? request.FrequencyPenalty : 0,
                presence_penalty = request.PresencePenalty != 0 ? request.PresencePenalty : 0,
                temperature = request.Temperature != 0 ? request.Temperature : 0.8
            };

            var jsonPayload = JsonSerializer.Serialize(payload);
            var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");

            var apiResponse = await httpClient.PostAsync(endpoint, content);

            if (!apiResponse.IsSuccessStatusCode)
            {
                var responseContentTest = await apiResponse.Content.ReadAsStringAsync();
                return Content(responseContentTest, "application/json");
            }

            var responseContent = await apiResponse.Content.ReadAsStringAsync();
            return Content(responseContent, "application/json");
        }
    }

    public class AICompletionRequest
    {
        public List<Message> Messages { get; set; }
        public string Model { get; set; }
        public double FrequencyPenalty { get; set; }
        public double PresencePenalty { get; set; }
        public double Temperature { get; set; }
        public int MaxTokens { get; set; }
    }

    public class Message
    {
        [JsonPropertyName("role")]
        public string Role { get; set; }

        [JsonPropertyName("content")]
        public string Content { get; set; }
    }
}