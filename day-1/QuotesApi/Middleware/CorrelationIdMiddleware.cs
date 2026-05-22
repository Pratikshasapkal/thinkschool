using Serilog.Context;

namespace QuotesApi.Middleware;

// Why correlation IDs matter:
//   Every log line emitted during a request shares the same TraceId.
//   When something goes wrong you can filter your log tool by TraceId and see the
//   full sequence: authentication → business logic → response — across every logger,
//   every middleware, and every service involved in that single request.
//   Without it you get a wall of interleaved log lines with no way to group them.
//
// The client can supply X-Correlation-ID to carry an ID across service boundaries
// (e.g. a front-end that already has a trace ID from its own observability stack).
// If none is supplied we generate one.
public sealed class CorrelationIdMiddleware
{
    private const string Header = "X-Correlation-ID";
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[Header].FirstOrDefault()
            ?? Guid.NewGuid().ToString("N");

        context.Response.Headers[Header] = correlationId;
        context.Items[Header] = correlationId;

        // LogContext.PushProperty uses AsyncLocal<T> — the value flows through every
        // await inside _next without any explicit passing. All loggers called during
        // this request automatically include TraceId in their structured output.
        using (LogContext.PushProperty("TraceId", correlationId))
        {
            await _next(context);
        }
    }
}
