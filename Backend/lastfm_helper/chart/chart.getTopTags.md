# chart.getTopTags

Get the top tags chart.

## Endpoint Details

| Property           | Value                           |
| ------------------ | ------------------------------- |
| **Method**         | GET                             |
| **Endpoint**       | `/2.0/?method=chart.gettoptags` |
| **Authentication** | Not Required                    |

## Parameters

| Parameter | Required | Description                                              |
| --------- | -------- | -------------------------------------------------------- |
| `page`    | No       | The page number to fetch. Defaults to first page.        |
| `limit`   | No       | The number of results to fetch per page. Defaults to 50. |
| `api_key` | Yes      | A Last.fm API key                                        |

## Example URLs

- **JSON**: `/2.0/?method=chart.gettoptags&api_key=YOUR_API_KEY&format=json`
- **XML**: `/2.0/?method=chart.gettoptags&api_key=YOUR_API_KEY`

## Sample Response (XML)

```xml
<tags page="1" perPage="50" totalPages="5" total="250">
  <tag>
    <name>rock</name>
    <url>http://www.last.fm/tag/rock</url>
    <reach>309437</reach>
    <taggings>3064604</taggings>
    <streamable>1</streamable>
    <wiki>
      <published>Sun, 24 Oct 2010 17:40:33 +0000</published>
      <summary>
Rock music is a genre of music started in America. It h...
      </summary>
      <content>
Rock music is a genre of music started in America. It has its roots in 1940s and 1950s rock and roll and rockabilly, which evolved from blues, country music and other influences. According to the All Music Guide, "In its pu...
      </content>
    </wiki>
  </tag>
  ...
</tags>
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

- `chart.getTopArtists` (previous)
- `chart.getTopTracks` (next)
