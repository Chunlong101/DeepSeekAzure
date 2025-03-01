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
            // Validate API key from request header
            if (!Request.Headers.TryGetValue("api-key", out var providedApiKey) || providedApiKey != _apiKey)
            {
                return Unauthorized(new { error = "Invalid or missing API key." });
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
                max_tokens = request.MaxTokens > 0 ? request.MaxTokens : 100,
                model = !string.IsNullOrEmpty(request.Model) ? request.Model : "DeepSeek-R1",
                frequency_penalty = request.FrequencyPenalty != 0 ? request.FrequencyPenalty : 0,
                presence_penalty = request.PresencePenalty != 0 ? request.PresencePenalty : 0,
                temperature = request.Temperature != 0 ? request.Temperature : 0.8
            };

            var jsonPayload = JsonSerializer.Serialize(payload);
            var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");

            var apiResponse = await httpClient.PostAsync(_endpoint, content);
            var apiResponseContent = await apiResponse.Content.ReadAsStringAsync();

            if (!apiResponse.IsSuccessStatusCode)
            {
                return StatusCode((int)apiResponse.StatusCode, new { error = "API request failed." });
            }

            var apiResponseJson = JsonDocument.Parse(apiResponseContent).RootElement;

            var response = new
            {
                choices = apiResponseJson.GetProperty("choices").EnumerateArray().Select(choice => new
                {
                    content_filter_results = new
                    {
                        hate = new { filtered = false, severity = "safe" },
                        protected_material_code = new { filtered = false, detected = false },
                        protected_material_text = new { filtered = false, detected = false },
                        self_harm = new { filtered = false, severity = "safe" },
                        sexual = new { filtered = false, severity = "safe" },
                        violence = new { filtered = false, severity = "safe" }
                    },
                    finish_reason = choice.GetProperty("finish_reason").GetString(),
                    index = choice.GetProperty("index").GetInt32(),
                    logprobs = (object)null,
                    message = new
                    {
                        content = choice.GetProperty("message").GetProperty("content").GetString(),
                        refusal = (object)null,
                        role = choice.GetProperty("message").GetProperty("role").GetString()
                    }
                }).ToArray(),
                created = apiResponseJson.GetProperty("created").GetInt32(),
                id = apiResponseJson.GetProperty("id").GetString(),
                model = apiResponseJson.GetProperty("model").GetString(),
                @object = apiResponseJson.GetProperty("object").GetString(),
                prompt_filter_results = new[]
                {
                    new
                    {
                        prompt_index = 0,
                        content_filter_results = new
                        {
                            hate = new { filtered = false, severity = "safe" },
                            jailbreak = new { filtered = false, detected = false },
                            self_harm = new { filtered = false, severity = "safe" },
                            sexual = new { filtered = false, severity = "safe" },
                            violence = new { filtered = false, severity = "safe" }
                        }
                    }
                },
                system_fingerprint = "fp_b705f0c291",
                usage = new
                {
                    completion_tokens = apiResponseJson.GetProperty("usage").GetProperty("completion_tokens").GetInt32(),
                    completion_tokens_details = new
                    {
                        accepted_prediction_tokens = 0,
                        audio_tokens = 0,
                        reasoning_tokens = 0,
                        rejected_prediction_tokens = 0
                    },
                    prompt_tokens = apiResponseJson.GetProperty("usage").GetProperty("prompt_tokens").GetInt32(),
                    prompt_tokens_details = new
                    {
                        audio_tokens = 0,
                        cached_tokens = 0
                    },
                    total_tokens = apiResponseJson.GetProperty("usage").GetProperty("total_tokens").GetInt32()
                }
            };

            return Ok(response);
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
