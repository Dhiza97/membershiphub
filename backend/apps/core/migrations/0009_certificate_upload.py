from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0008_certificate")]

    operations = [
        migrations.AddField(
            model_name="certificate",
            name="pdf_data",
            field=models.BinaryField(editable=False, null=True),
        ),
        migrations.AlterField(
            model_name="certificate",
            name="attendance_percentage",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AlterField(
            model_name="certificate",
            name="assessment_average",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AlterField(
            model_name="certificate",
            name="minimum_attendance",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AlterField(
            model_name="certificate",
            name="minimum_assessment_score",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
    ]