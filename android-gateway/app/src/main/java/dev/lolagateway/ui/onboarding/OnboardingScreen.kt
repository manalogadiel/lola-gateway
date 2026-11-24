package dev.lolagateway.ui.onboarding

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.lolagateway.R
import dev.lolagateway.ui.components.SoftTextField
import dev.lolagateway.ui.theme.LocalLolaColors

private val CanopyPeriwinkle = Color(0xFF5E69DC)

@Composable
fun OnboardingScreen(
    signedIn: Boolean, configured: Boolean, busy: Boolean, error: String?,
    signIn: () -> Unit, createFamily: (String, String, String) -> Unit,
) {
    val lola = LocalLolaColors.current
    var familyName by rememberSaveable { mutableStateOf("") }
    var seniorName by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().background(lola.canvas).verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Curved #5E69DC canopy seamlessly matching lola_welcome.jpg
        Column(
            modifier = Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 44.dp, bottomEnd = 44.dp))
                .background(CanopyPeriwinkle)
                .statusBarsPadding()
                .padding(top = 18.dp, start = 24.dp, end = 24.dp, bottom = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "lola gateway",
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.9).sp,
                color = Color.White,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Keep Lola in the family chat",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.90f),
            )
            Spacer(Modifier.height(8.dp))
            Image(
                painter = painterResource(R.drawable.lola_welcome),
                contentDescription = "Smiling Lola mascot waving hello",
                modifier = Modifier.size(width = 196.dp, height = 168.dp),
                contentScale = ContentScale.Crop,
            )
        }

        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                if (signedIn) "Set up Gateway" else "Welcome home",
                style = MaterialTheme.typography.headlineMedium,
                color = lola.ink,
                textAlign = TextAlign.Center,
            )
            Text(
                if (signedIn) "Link Lola's keypad number to create your family bridge."
                else "Sign in with Google to set up this phone as your family SMS bridge.",
                style = MaterialTheme.typography.bodyMedium,
                color = lola.inkSecondary,
                textAlign = TextAlign.Center,
            )

            if (error != null) {
                Surface(color = lola.coralSoft, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(
                        error,
                        color = lola.coralInk,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            if (!signedIn) {
                if (!configured) {
                    Surface(color = lola.marigoldBubble, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                        Text(
                            "Add google-services.json with your Firebase project config to enable Google Sign-In.",
                            color = lola.marigoldInk,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        )
                    }
                }
                Button(
                    onClick = signIn,
                    enabled = configured && !busy,
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = lola.periwinkle,
                        contentColor = Color.White,
                    ),
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                ) {
                    Text(if (busy) "Signing in..." else "Continue with Google", style = MaterialTheme.typography.titleMedium)
                }
            } else {
                SoftTextField(familyName, { familyName = it }, "Family name (e.g. Manalo Family)", Modifier.fillMaxWidth())
                SoftTextField(seniorName, { seniorName = it }, "Lola's name (e.g. Lola Elena)", Modifier.fillMaxWidth())
                SoftTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    placeholder = "Lola's mobile number (e.g. 0917 123 4567)",
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                )
                Spacer(Modifier.height(4.dp))
                Button(
                    onClick = { createFamily(familyName, seniorName, phone) },
                    enabled = !busy && familyName.isNotBlank() && seniorName.isNotBlank() && phone.isNotBlank(),
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = lola.periwinkle,
                        contentColor = Color.White,
                    ),
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                ) {
                    Text(if (busy) "Creating bridge..." else "Create Family Bridge", style = MaterialTheme.typography.titleMedium)
                }
            }

            Spacer(Modifier.height(4.dp))
            Text(
                "No app needed on Lola's keypad phone",
                style = MaterialTheme.typography.labelMedium,
                color = lola.inkSecondary,
                textAlign = TextAlign.Center,
            )
        }
    }
}
