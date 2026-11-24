package dev.lolagateway.ui.loading

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import dev.lolagateway.R
import dev.lolagateway.ui.theme.LocalLolaColors

private val LavenderStage = Color(0xFFE9EAFC)

@Composable
fun LoadingScreen() {
    val lola = LocalLolaColors.current
    val bg = if (lola.dark) Color(0xFF110F1B) else LavenderStage
    val titleColor = if (lola.dark) Color(0xFFF5F3FA) else Color(0xFF1A1826)
    val subColor = if (lola.dark) Color(0xFFABA5C2) else Color(0xFF565273)

    Column(
        Modifier.fillMaxSize().background(bg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(
            Modifier.padding(top = 96.dp, start = 24.dp, end = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(42.dp),
                strokeWidth = 4.dp,
                color = lola.periwinkle,
                trackColor = lola.periwinkle.copy(alpha = 0.22f),
            )
            Spacer(Modifier.height(4.dp))
            Text("Connecting to family", style = MaterialTheme.typography.headlineMedium, color = titleColor)
            Text("Checking for new texts from Lola...", style = MaterialTheme.typography.bodyMedium, color = subColor)
        }

        Box(
            modifier = Modifier.fillMaxWidth()
                .clip(if (lola.dark) RoundedCornerShape(topStart = 120.dp, topEnd = 120.dp) else RoundedCornerShape(0.dp))
                .background(LavenderStage),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Image(
                painter = painterResource(R.drawable.lola_peeking),
                contentDescription = "Cute Lola peeking up",
                modifier = Modifier.fillMaxWidth().height(290.dp),
                contentScale = ContentScale.Crop,
                alignment = Alignment.BottomCenter,
            )
        }
    }
}
