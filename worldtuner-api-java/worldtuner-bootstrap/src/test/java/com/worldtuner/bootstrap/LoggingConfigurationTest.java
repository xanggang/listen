package com.worldtuner.bootstrap;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.joran.JoranConfigurator;
import ch.qos.logback.classic.util.LogbackMDCAdapter;
import ch.qos.logback.core.util.StatusPrinter;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class LoggingConfigurationTest {

  /**
   * 使用独立日志上下文验证真实配置：文件分流、UTF-8、堆栈及重启追加均符合预期。
   */
  @Test
  void writesSeparateFilesAndAppendsAfterRestart(@TempDir Path directory) throws Exception {
    for (int attempt = 0; attempt < 2; attempt++) {
      LoggerContext context = new LoggerContext();
      context.setMDCAdapter(new LogbackMDCAdapter());
      context.putProperty("worldtuner.log-dir", directory.toString());
      try {
        JoranConfigurator configurator = new JoranConfigurator();
        configurator.setContext(context);
        configurator.doConfigure(getClass().getResource("/logback-spring.xml"));
        StatusPrinter.printInCaseOfErrorsOrWarnings(context);
        Logger logger = context.getLogger("logging-test");
        logger.info("运行标记-{}", attempt);
        logger.warn("警告标记-{}", attempt);
        logger.error("错误标记-" + attempt, new IllegalStateException("异常详情"));
      } finally {
        context.stop();
      }
    }
    String app = Files.readString(directory.resolve("app.log"));
    String errors = Files.readString(directory.resolve("error.log"));
    for (int attempt = 0; attempt < 2; attempt++) {
      assertTrue(app.contains("运行标记-" + attempt));
      assertTrue(app.contains("警告标记-" + attempt));
      assertTrue(app.contains("错误标记-" + attempt));
      assertTrue(errors.contains("错误标记-" + attempt));
    }
    assertFalse(errors.contains("运行标记"));
    assertFalse(errors.contains("警告标记"));
    assertTrue(errors.contains("java.lang.IllegalStateException: 异常详情"));
  }
}
