using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DeepSeekAzure.Controllers
{
    [ApiController]
    [Route("openai/deployments/deepseek-r1/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly string _apiKey;
        private readonly string _endpoint;

        public ChatController(IConfiguration configuration)
        {
            _apiKey = configuration["ApiKey"];
            _endpoint = configuration["Endpoint"];
        }

        /// <summary>
        /// Call Azure AI Foundry API to get completions.
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        [HttpPost("completions")]
        public async Task<IActionResult> Completions([FromBody] AICompletionRequest request)
        {
            bool b1 = false;
            if (!Request.Headers.TryGetValue("api-key", out var providedApiKey) || providedApiKey != _apiKey)
            {
                b1 = false; // Unauthorized
            }
            else
            {
                b1 = true;
            }
            bool b2 = false;
            if (!Request.Headers.TryGetValue("Authorization", out var authorizationHeader) || !authorizationHeader.ToString().StartsWith("Bearer ") || authorizationHeader.ToString().Substring("Bearer ".Length) != _apiKey)
            {
                b2 = false; // Unauthorized
            }
            else
            {
                b2 = true;
            }
            if (!(b1 || b2))
            {
                // 其中有一个验证通过，就算验证成功，若都不通过，则返回 Unauthorized
                return Unauthorized(new { error = "Unauthorized." });
            }

            // Validate request
            if (request.Messages == null || request.Messages.Count == 0)
            {
                return BadRequest(new { error = "Prompt is required." });
            }

            using var httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromMinutes(5)
            };

            httpClient.DefaultRequestHeaders.Add("api-key", _apiKey);

            var payload = new
            {
                messages = request.Messages,
                model = request.Model,
                max_tokens = request.MaxTokens,
                frequency_penalty = request.FrequencyPenalty,
                presence_penalty = request.PresencePenalty,
                temperature = request.Temperature,
                top_p = request.TopP,
                n = request.N,
                stream = request.Stream
            };

            var jsonPayload = JsonSerializer.Serialize(payload);
            var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");

            var apiResponse = await httpClient.PostAsync(_endpoint, content);

            if (request.Stream)
            {
                Response.Headers.Append("Content-Type", "text/event-stream");
                
                using var responseStream = await apiResponse.Content.ReadAsStreamAsync();
                await responseStream.CopyToAsync(Response.Body);
                return new EmptyResult();
            }
            else
            {
                var apiResponseContent = await apiResponse.Content.ReadAsStringAsync();

                if (!apiResponse.IsSuccessStatusCode)
                {
                    return StatusCode((int)apiResponse.StatusCode, new { error = "API request failed." });
                }

                var apiResponseJson = JsonDocument.Parse(apiResponseContent).RootElement;

                var response = new
                {
                    id = apiResponseJson.GetProperty("id").GetString(),
                    @object = apiResponseJson.GetProperty("object").GetString(),
                    created = apiResponseJson.GetProperty("created").GetInt32(),
                    model = apiResponseJson.GetProperty("model").GetString(),
                    usage = new
                    {
                        prompt_tokens = apiResponseJson.GetProperty("usage").GetProperty("prompt_tokens").GetInt32(),
                        completion_tokens = apiResponseJson.GetProperty("usage").GetProperty("completion_tokens").GetInt32(),
                        total_tokens = apiResponseJson.GetProperty("usage").GetProperty("total_tokens").GetInt32()
                    },
                    choices = apiResponseJson.GetProperty("choices").EnumerateArray().Select(choice => new
                    {
                        message = new
                        {
                            role = choice.GetProperty("message").GetProperty("role").GetString(),
                            content = choice.GetProperty("message").GetProperty("content").GetString()
                        },
                        finish_reason = choice.GetProperty("finish_reason").GetString(),
                        index = choice.GetProperty("index").GetInt32()
                    }).ToArray()
                };

                return Ok(response);
            }
        }
    }

    public class AICompletionRequest
    {
        public List<Message> Messages { get; set; }
        public string Model { get; set; } = "DeepSeek-R1";
        public double FrequencyPenalty { get; set; } = 0.0;
        public double PresencePenalty { get; set; } = 0.0;
        public double Temperature { get; set; } = 0.8;
        public int MaxTokens { get; set; } = 4096;
        public double TopP { get; set; } = 1.0;
        public int N { get; set; } = 1;
        public bool Stream { get; set; } = true;
    }

    public class Message
    {
        [JsonPropertyName("role")]
        public string Role { get; set; }

        [JsonPropertyName("content")]
        public JsonElement Content { get; set; }
    }

    public class ContentItem
    {
        [JsonPropertyName("type")]
        public string Type { get; set; }

        [JsonPropertyName("text")]
        public string Text { get; set; }
    }
}
