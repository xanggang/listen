package com.worldtuner.client.shared;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.worldtuner.common.ApiError;
import com.worldtuner.common.ApiResult;
import com.worldtuner.common.QueryValidation;
import com.worldtuner.domain.metrics.MetricsService;
import com.worldtuner.domain.metrics.VisitInput;
import com.worldtuner.domain.metrics.VisitInputParser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * 匿名访问统计接口：限制请求体大小、字段和页面名后写入统计；不返回可查询的用户数据。
 * 行为与 Worker 版 metrics.routes.ts 一致。
 */
@RestController
@RequestMapping("/api/metrics")
public class MetricsController {

  // 请求体上限：与 Worker 版保持一致，防止误上传大负载。
  private static final int MAX_PAYLOAD_BYTES = 1024;

  private final MetricsService service;

  private final ObjectMapper objectMapper;

  /**
   * 注入统计服务与 JSON 解析器。
   *
   * @param service      统计业务服务
   * @param objectMapper 共享 JSON 解析器
   */
  public MetricsController(MetricsService service, ObjectMapper objectMapper) {
    this.service = service;
    this.objectMapper = objectMapper;
  }

  /**
   * 记录一次匿名页面访问；统计失败会以 5xx 返回，客户端自行静默重试或丢弃。
   *
   * @param request HTTP 请求
   * @return 固定的成功标记
   */
  @PostMapping("/visit")
  public ApiResult<Map<String, Boolean>> visit(HttpServletRequest request) {
    QueryValidation.validateParams(request.getParameterMap());
    String contentType = request.getHeader("Content-Type");
    if (contentType == null
        || !contentType.toLowerCase(java.util.Locale.ROOT).startsWith("application/json")) {
      throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON body required");
    }
    String raw = readBody(request);
    JsonNode body;
    try {
      body = objectMapper.readTree(raw);
    } catch (IOException e) {
      throw new ApiError(400, "INVALID_METRIC", "Invalid JSON body");
    }
    if (!body.isObject()) {
      throw new ApiError(400, "INVALID_METRIC", "Invalid visit payload");
    }
    VisitInput input = VisitInputParser.parse(stringFields(body));
    service.recordVisit(input);
    return ApiResult.of(Map.of("recorded", true));
  }

  /**
   * 读取请求体并执行长度校验：先看 Content-Length 头，再校验实际字节。
   *
   * @param request HTTP 请求
   * @return 请求体文本
   */
  private String readBody(HttpServletRequest request) {
    String lengthHeader = request.getHeader("Content-Length");
    if (lengthHeader != null) {
      try {
        if (Long.parseLong(lengthHeader.trim()) > MAX_PAYLOAD_BYTES) {
          throw tooLarge();
        }
      } catch (NumberFormatException ignored) {
        // 缺失或非法的长度头交给实际字节校验兜底。
      }
    }
    try {
      byte[] payload = request.getInputStream().readAllBytes();
      if (payload.length > MAX_PAYLOAD_BYTES) {
        throw tooLarge();
      }
      return new String(payload, java.nio.charset.StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new UncheckedIOException("failed to read visit payload", e);
    }
  }

  /**
   * 构造 413 业务异常。
   *
   * @return 业务异常
   */
  private static ApiError tooLarge() {
    return new ApiError(413, "PAYLOAD_TOO_LARGE", "Visit payload too large");
  }

  /**
   * 把 JSON 对象展开为字段名到文本值的映射；非字符串值保持 JSON 文本形式，
   * 由解析器统一判定格式非法。
   *
   * @param body JSON 对象节点
   * @return 字段映射
   */
  private Map<String, String> stringFields(JsonNode body) {
    Map<String, String> fields = new HashMap<>();
    Iterator<Map.Entry<String, JsonNode>> iterator = body.fields();
    while (iterator.hasNext()) {
      Map.Entry<String, JsonNode> entry = iterator.next();
      JsonNode value = entry.getValue();
      fields.put(entry.getKey(), value.isTextual() ? value.textValue() : value.toString());
    }
    return fields;
  }
}
