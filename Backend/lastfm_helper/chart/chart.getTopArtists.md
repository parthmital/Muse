# chart.getTopArtists

Get the top artists chart.

## Endpoint Details

| Property           | Value                              |
| ------------------ | ---------------------------------- |
| **Method**         | GET                                |
| **Endpoint**       | `/2.0/?method=chart.gettopartists` |
| **Authentication** | Not Required                       |

## Parameters

| Parameter | Required | Description                                              |
| --------- | -------- | -------------------------------------------------------- |
| `page`    | No       | The page number to fetch. Defaults to first page.        |
| `limit`   | No       | The number of results to fetch per page. Defaults to 50. |
| `api_key` | Yes      | A Last.fm API key                                        |

## Example URLs

- **JSON**: `/2.0/?method=chart.gettopartists&api_key=YOUR_API_KEY&format=json`
- **XML**: `/2.0/?method=chart.gettopartists&api_key=YOUR_API_KEY`

## Sample Response (XML)

```xml
<artists page="1" perPage="50" totalPages="20" total="1000">
  <artist>
    <name>The Beatles</name>
    <playcount>1550293</playcount>
    <listeners>114106</listeners>
    <mbid>b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d</mbid>
    <url>http://www.last.fm/music/The+Beatles</url>
    <streamable>1</streamable>
    <image size="small">http://userserve-ak.last.fm/serve/34/880929.jpg</image>
    <image size="medium">http://userserve-ak.last.fm/serve/64/880929.jpg</image>
    <image size="large">http://userserve-ak.last.fm/serve/126/880929.jpg</image>
    <image size="extralarge">http://userserve-ak.last.fm/serve/252/880929.jpg</image>
    <image size="mega">http://userserve-ak.last.fm/serve/500/880929/The+Beatles.jpg</image>
  </artist>
  ...
</artists>
```

## Error Codes

| Code | Description                                                                            |
| ---- | -------------------------------------------------------------------------------------- |
| 2    | Invalid service - This service does not exist                                          |
| 3    | Invalid Method - No method with that name in this package                              |
| 4    | Authentication Failed - You do not have permissions to access the service              |
| 5    | Invalid format - This service doesn't exist in that format                             |
| 6    | Invalid parameters - Your request is missing a required parameter                      |
| 7    | Invalid resource specified                                                             |
| 8    | Operation failed - Something else went wrong                                           |
| 9    | Invalid session key - Please re-authenticate                                           |
| 10   | Invalid API key - You must be granted a valid key by last.fm                           |
| 11   | Service Offline - This service is temporarily offline. Try again later.                |
| 13   | Invalid method signature supplied                                                      |
| 16   | There was a temporary error processing your request. Please try again                  |
| 26   | Suspended API key - Access for your account has been suspended, please contact Last.fm |
| 29   | Rate limit exceeded - Your IP has made too many requests in a short period             |

## Related Methods

- `auth.getToken` (previous)
- `chart.getTopTags` (next)
