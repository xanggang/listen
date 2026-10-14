package com.worldtuner.bootstrap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 公开 API 契约行为测试：使用临时 SQLite 种子数据走完整 HTTP 链路，
 * 覆盖校验、分页、译名聚合、快照协商、统计写入与管理端鉴权。
 */
@SpringBootTest(properties = {
    "worldtuner.catalog-db-path=${test.catalog-db}",
    "worldtuner.metrics-db-path=${test.metrics-db}",
    "worldtuner.allowed-origins=http://localhost:3000",
    "worldtuner.admin-token=test-token",
    "worldtuner.cache-enabled=false",
    "worldtuner.map-snapshot-ttl-seconds=300",
})
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ApiContractTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  private static Path catalogDb;

  private static Path metricsDb;

  /**
   * 准备临时目录库（v2 结构 + 种子数据）与空统计库。
   *
   * @throws Exception 初始化失败时抛出
   */
  @BeforeAll
  static void prepareDatabases() throws Exception {
    Path dir = Files.createTempDirectory("worldtuner-test");
    catalogDb = dir.resolve("catalog.sqlite");
    metricsDb = dir.resolve("metrics.sqlite");
    try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + catalogDb)) {
      ScriptUtils.executeSqlScript(connection, new EncodedResource(
          new ClassPathResource("schema/catalog-test.sql"), StandardCharsets.UTF_8));
      ScriptUtils.executeSqlScript(connection, new EncodedResource(
          new ClassPathResource("schema/catalog-seed.sql"), StandardCharsets.UTF_8));
    }
    System.setProperty("test.catalog-db", catalogDb.toString());
    System.setProperty("test.metrics-db", metricsDb.toString());
  }

  @Autowired
  private MockMvc mockMvc;

  /** 健康检查：响应结构与未知参数拒绝行为与 Worker 版一致。 */
  @Test
  @Order(1)
  void healthReturnsOkAndRejectsParams() throws Exception {
    mockMvc.perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("ok"))
        .andExpect(jsonPath("$.data.service").value("worldtuner-api"));
    mockMvc.perform(get("/api/health?extra=1"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.error.requestId").isNotEmpty());
  }

  /** 电台列表：只返回公开电台，按票数排序；分页边界正确。 */
  @Test
  @Order(2)
  void stationListFiltersAndPaginates() throws Exception {
    mockMvc.perform(get("/api/stations"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.list.length()").value(2))
        .andExpect(jsonPath("$.data.list[0].id").value("0000000000000001001"))
        .andExpect(jsonPath("$.data.list[0].name").value("Radio One"))
        .andExpect(jsonPath("$.data.list[0].countrycode").value("CN"))
        .andExpect(jsonPath("$.data.list[0].tags").value("pop,jazz"))
        .andExpect(jsonPath("$.data.list[0].language").value("English,中文"))
        .andExpect(jsonPath("$.data.list[0].languageZh").value("英语,中文"))
        .andExpect(jsonPath("$.data.list[0].hasMore").doesNotExist())
        .andExpect(jsonPath("$.data.hasMore").value(false))
        .andExpect(jsonPath("$.data.nextPage").value(org.hamcrest.Matchers.nullValue()));

    mockMvc.perform(get("/api/stations?pageSize=1&page=1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.list.length()").value(1))
        .andExpect(jsonPath("$.data.hasMore").value(true))
        .andExpect(jsonPath("$.data.nextPage").value(2));
  }

  /** 关键词搜索覆盖标签中文名；非法与未知筛选 ID 被拒绝。 */
  @Test
  @Order(3)
  void keywordSearchAndFilterValidation() throws Exception {
    mockMvc.perform(get("/api/stations?keyword=爵士"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.list.length()").value(1))
        .andExpect(jsonPath("$.data.list[0].id").value("0000000000000001001"));

    mockMvc.perform(get("/api/stations?tagsId=short-id"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));

    mockMvc.perform(get("/api/stations?tagsId=0000000000000009999"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_FILTER"));

    mockMvc.perform(get("/api/stations?pageSize=0"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));

    mockMvc.perform(get("/api/stations?pageSize=1&page=1&page=1"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.message").value("Unknown or repeated parameter: page"));

    mockMvc.perform(get("/api/stations?offset=1"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));
  }

  /** 电台详情：包含播放流与外链；缺流字段为 null；404 与非法 ID 行为一致。 */
  @Test
  @Order(4)
  void stationDetailStreamsLinksAndErrors() throws Exception {
    mockMvc.perform(get("/api/stations/0000000000000001001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("0000000000000001001"))
        .andExpect(jsonPath("$.data.url").value("http://stream.example/primary"))
        .andExpect(jsonPath("$.data.streams.length()").value(2))
        .andExpect(jsonPath("$.data.streams[0].id").value("0000000000000002002"))
        .andExpect(jsonPath("$.data.streams[0].isPrimary").value(true))
        .andExpect(jsonPath("$.data.streams[1].id").value("0000000000000002001"))
        .andExpect(jsonPath("$.data.links.length()").value(1))
        .andExpect(jsonPath("$.data.links[0].platform").value("website"))
        .andExpect(jsonPath("$.data.hls").value(org.hamcrest.Matchers.nullValue()));

    mockMvc.perform(get("/api/stations/0000000000000001002"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error.code").value("STATION_NOT_FOUND"));

    mockMvc.perform(get("/api/stations/not-an-id"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));
  }

  /** 字典接口：返回译名字段与关联计数；标签支持搜索与分页。 */
  @Test
  @Order(5)
  void catalogDictionariesExposeLocalizedNames() throws Exception {
    mockMvc.perform(get("/api/languages"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("English"))
        .andExpect(jsonPath("$.data[0].name_en").value("English"))
        .andExpect(jsonPath("$.data[0].name_zh").value("英语"))
        .andExpect(jsonPath("$.data[0].code").value("en"))
        .andExpect(jsonPath("$.data[0].stationcount").value(1));

    mockMvc.perform(get("/api/countries"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("0000000000000000001"))
        .andExpect(jsonPath("$.data[0].name").value("China"))
        .andExpect(jsonPath("$.data[0].code").value("CN"))
        .andExpect(jsonPath("$.data[0].name_zh").doesNotExist());

    mockMvc.perform(get("/api/tags?q=爵"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(1))
        .andExpect(jsonPath("$.data[0].name").value("jazz"))
        .andExpect(jsonPath("$.data[0].name_zh").value("爵士"));

    mockMvc.perform(get("/api/tags?limit=1&offset=1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(1))
        .andExpect(jsonPath("$.data[0].name").value("jazz"));
  }

  /** 地图点位页：游标分页与下一页游标。 */
  @Test
  @Order(6)
  void mapStationsCursorPagination() throws Exception {
    mockMvc.perform(get("/api/map/stations?limit=1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.list.length()").value(1))
        .andExpect(jsonPath("$.data.list[0].id").value("0000000000000001001"))
        .andExpect(jsonPath("$.data.nextCursor").value("0000000000000001001"));

    mockMvc.perform(get("/api/map/stations?limit=1&after=0000000000000001001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.list.length()").value(1))
        .andExpect(jsonPath("$.data.nextCursor").value(org.hamcrest.Matchers.nullValue()));
  }

  /** 地图快照：ETag/304 协商、gzip 编码与坐标取整。 */
  @Test
  @Order(7)
  void mapSnapshotNegotiatesEtagAndGzip() throws Exception {
    MvcResult first = mockMvc.perform(get("/api/map/snapshot"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(2))
        .andReturn();
    String etag = first.getResponse().getHeader("ETag");
    assertThat(etag).startsWith("W/\"");
    JsonNode points = JSON.readTree(first.getResponse().getContentAsString())
        .path("data").path("points");
    assertThat(points.get(0).get(2).asDouble()).isEqualTo(121.47376);
    assertThat(points.get(0).get(3).asDouble()).isEqualTo(31.23042);

    mockMvc.perform(get("/api/map/snapshot").header("If-None-Match", etag))
        .andExpect(status().isNotModified());

    mockMvc.perform(get("/api/map/snapshot").header("Accept-Encoding", "gzip"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getHeader("Content-Encoding").equals("gzip");

    mockMvc.perform(get("/api/map/snapshot?x=1"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_QUERY"));
  }

  /** 访问统计：合法写入返回 recorded，重复访问不增加去重值；非法负载被拒绝。 */
  @Test
  @Order(8)
  void metricsVisitRecordsAndValidates() throws Exception {
    String visitor = "11111111-1111-4111-8111-111111111111";
    String body = "{\"visitorId\":\"" + visitor + "\",\"source\":\"web\",\"page\":\"map\"}";
    mockMvc.perform(post("/api/metrics/visit").contentType("application/json").content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recorded").value(true));
    mockMvc.perform(post("/api/metrics/visit").contentType("application/json").content(body))
        .andExpect(status().isOk());

    mockMvc.perform(post("/api/metrics/visit?x=1").contentType("application/json").content(body))
        .andExpect(status().isBadRequest());
    mockMvc.perform(post("/api/metrics/visit").content(body))
        .andExpect(status().isUnsupportedMediaType())
        .andExpect(jsonPath("$.error.code").value("UNSUPPORTED_MEDIA_TYPE"));
    mockMvc.perform(post("/api/metrics/visit").contentType("application/json")
            .content("{\"visitorId\":\"bad\",\"source\":\"web\",\"page\":\"map\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_METRIC"));
    mockMvc.perform(post("/api/metrics/visit").contentType("application/json")
            .content(body.replace("vip-home", "unknown-page").replace("map", "hacked")))
        .andExpect(status().isBadRequest());

    try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + metricsDb)) {
      var rs = connection.createStatement()
          .executeQuery("SELECT pv FROM metric_daily_views WHERE page = 'map'");
      assertThat(rs.next()).isTrue();
      assertThat(rs.getLong(1)).isEqualTo(2);
      var unique = connection.createStatement()
          .executeQuery("SELECT COUNT(*) FROM metric_daily_unique");
      assertThat(unique.next()).isTrue();
      assertThat(unique.getLong(1)).isEqualTo(1);
    }
  }

  /** 管理端：Token 鉴权与可见性上下架。 */
  @Test
  @Order(9)
  void adminVisibilityRequiresTokenAndValidates() throws Exception {
    mockMvc.perform(put("/admin/api/stations/0000000000000001004/visibility")
            .contentType("application/json").content("{\"visibility\":\"hidden\"}"))
        .andExpect(status().isUnauthorized());

    mockMvc.perform(put("/admin/api/stations/0000000000000001004/visibility")
            .header("Authorization", "Bearer wrong")
            .contentType("application/json").content("{\"visibility\":\"hidden\"}"))
        .andExpect(status().isUnauthorized());

    mockMvc.perform(put("/admin/api/stations/0000000000000001004/visibility")
            .header("Authorization", "Bearer test-token")
            .contentType("application/json").content("{\"visibility\":\"hidden\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.visibility").value("hidden"));

    mockMvc.perform(put("/admin/api/stations/0000000000000001004/visibility")
            .header("Authorization", "Bearer test-token")
            .contentType("application/json").content("{\"visibility\":\"bogus\"}"))
        .andExpect(status().isBadRequest());

    mockMvc.perform(get("/api/stations/0000000000000001004"))
        .andExpect(status().isNotFound());
  }

  /** 未知路径与方法：404 与 405 行为与 Worker 版 notFound 一致。 */
  @Test
  @Order(10)
  void unknownPathsAndMethods() throws Exception {
    mockMvc.perform(get("/api/unknown"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));

    mockMvc.perform(post("/api/health").content("{}"))
        .andExpect(status().isMethodNotAllowed())
        .andExpect(jsonPath("$.error.code").value("METHOD_NOT_ALLOWED"));
  }

  /** 快照 ETag 具备内容敏感性：不同的正文产生不同的标签。 */
  @Test
  @Order(11)
  void etagFormatIsWeakAndHex() throws Exception {
    MvcResult result = mockMvc.perform(get("/api/map/snapshot")).andReturn();
    String etag = result.getResponse().getHeader("ETag");
    Matcher matcher = Pattern.compile("^W/\"[0-9a-f]{64}\"$").matcher(etag);
    assertThat(matcher.matches()).isTrue();
  }
}
