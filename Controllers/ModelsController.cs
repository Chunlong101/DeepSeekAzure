using Microsoft.AspNetCore.Mvc;
using System;

namespace DeepSeekAzure.Controllers
{
    [ApiController]
    [Route("openai/deployments/deepseek-r1/[controller]")]
    public class ModelsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetModels()
        {
            var response = new
            {
                @object = "list",
                data = new[]
                {
                    new
                    {
                        id = "DeepSeek-R1",
                        @object = "model",
                        created = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                        owned_by = "system"
                    }
                }
            };

            return Ok(response);
        }
    }
}
