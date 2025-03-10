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
        /// Call Azure AI Foundry API to get completions and then generate the completions to client.
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

            if (request.Stream)
            {
                // Proper streaming setup
                var requestMessage = new HttpRequestMessage(HttpMethod.Post, _endpoint)
                {
                    Content = content
                };
                requestMessage.Headers.Add("api-key", _apiKey);

                // Add cancellation token from the client request
                var clientCancellationToken = HttpContext.RequestAborted;

                try
                {
                    // Use SendAsync with ResponseHeadersRead to start processing as soon as headers arrive
                    var responseFromAAF = await httpClient.SendAsync(
                        requestMessage,
                        HttpCompletionOption.ResponseHeadersRead,
                        clientCancellationToken);

                    if (!responseFromAAF.IsSuccessStatusCode)
                    {
                        return StatusCode((int)responseFromAAF.StatusCode, new { error = "API request failed." });
                    }

                    // Set response headers for streaming
                    Response.Headers.Append("Content-Type", "text/event-stream");
                    Response.Headers.Append("Cache-Control", "no-cache");
                    Response.Headers.Append("Connection", "keep-alive");
                    
                    using var responseStream = await responseFromAAF.Content.ReadAsStreamAsync(clientCancellationToken);
                    
                    // Stream the response in small chunks for real-time delivery
                    byte[] buffer = new byte[1024]; // 1KB chunks for responsive streaming
                    int bytesRead;
                    
                    while ((bytesRead = await responseStream.ReadAsync(buffer, 0, buffer.Length, clientCancellationToken)) > 0)
                    {
                        await Response.Body.WriteAsync(buffer, 0, bytesRead, clientCancellationToken);
                        await Response.Body.FlushAsync(clientCancellationToken); // Important: flush after each chunk
                    }
                    
                    return new EmptyResult();
                }
                catch (OperationCanceledException)
                {
                    // Client disconnected, handle gracefully
                    return new EmptyResult();
                }
                catch (Exception ex)
                {
                    // Only log the error if headers haven't been sent yet
                    if (!Response.HasStarted)
                    {
                        return StatusCode(500, new { error = $"Streaming error: {ex.Message}" });
                    }
                    
                    // If headers are already sent, we can't change the response status code
                    return new EmptyResult();
                }
            }
            else
            {
                // Non-streaming request
                var apiResponse = await httpClient.PostAsync(_endpoint, content);
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
